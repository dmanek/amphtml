/**
 * Copyright 2020 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// import {CSS} from '../../../build/amp-render-0.1.css';
import {Deferred} from '../../../src/utils/promise';
import {Pass} from '../../../src/pass';
import {dev, devAssert, user, userAssert} from '../../../src/log';
import {getValueForExpr} from '../../../src/json';
import {isArray, toArray} from '../../../src/types';

/** @const {string} */
const TAG = 'amp-render';
const AMP_STATE_URI_SCHEME = 'amp-state:';
const AMP_SCRIPT_URI_SCHEME = 'amp-script:';

export class AmpRender extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    // Declare instance variables with type annotations.
    /**
     * Maintains invariant that only one fetch result may be processed for
     * render at a time.
     * @const @private {!../../../src/pass.Pass}
     */
    this.renderPass_ = new Pass(this.win, () => this.doRenderPass_());

    /**
     * Latest fetched items to render and the promise resolver and rejecter
     * to be invoked on render success or fail, respectively.
     * @private {?RenderItems}
     */
    this.renderItems_ = null;

    /** @private {?Array} */
    this.renderedItems_ = null;
  }

  /** @override */
  isLayoutSupported(layout) {
    return layout == 'fixed';
  }

  /** @override */
  buildCallback() {
    // Get attributes, assertions of values, assign instance variables.
    // Build lightweight DOM and append to this.element.
  }

  /** @override */
  layoutCallback() {
    // Actually load your resource or render more expensive resources.
    this.fetchData_();
  }

  /**
   * Request data from `src` and return a promise that resolves when
   * the list has been populated with rendered list items. If the viewer is
   * capable of rendering the templates, then the fetching of the list and
   * transformation of the template is handled by the viewer.
   * @param {{refresh: (boolean|undefined), append: (boolean|undefined)}=} options
   * @return {!Promise}
   * @private
   */
  fetchData_(options = {}) {
    const {refresh = false, append = false} = options;
    const elementSrc = this.element.getAttribute('src');
    if (!elementSrc) {
      return Promise.resolve();
    }
    let fetch;
    if (this.isAmpScriptSrc_(elementSrc)) {
      fetch = this.getAmpScriptJson_(elementSrc);
    }

    fetch.then((data) => {
      // Bail if the src has changed while resolving the xhr request.
      if (elementSrc !== this.element.getAttribute('src')) {
        return;
      }

      const items = this.computeListItems_(data);
      return this.scheduleRender_(items, /* append */ false, data);
    });

    return fetch.catch((error) => {
      // Append flow has its own error handling
      if (append) {
        throw error;
      }

      this.triggerFetchErrorEvent_(error);
      this.showFallback_();
      throw error;
    });
  }

  /**
   * Returns true if element's src points to an amp-script function.
   *
   * @param {string} src
   * @return {boolean}
   * @private
   */
  isAmpScriptSrc_(src) {
    return src.startsWith(AMP_SCRIPT_URI_SCHEME);
  }

  /**
   * Gets the json from an amp-script uri.
   *
   * @param {string} src
   * @return {Promise<!JsonObject>}
   * @private
   */
  getAmpScriptJson_(src) {
    return Promise.resolve()
      .then(() => {
        // userAssert(
        //   !this.ssrTemplateHelper_.isEnabled(),
        //   '[amp-list]: "amp-script" URIs cannot be used in SSR mode.'
        // );

        const args = src.slice(AMP_SCRIPT_URI_SCHEME.length).split('.');
        userAssert(
          args.length === 2 && args[0].length > 0 && args[1].length > 0,
          '[amp-list]: "amp-script" URIs must be of the format "scriptId.functionIdentifier".'
        );

        const ampScriptId = args[0];
        const fnIdentifier = args[1];
        const ampScriptEl = this.element
          .getAmpDoc()
          .getElementById(ampScriptId);
        userAssert(
          ampScriptEl && ampScriptEl.tagName === 'AMP-SCRIPT',
          `[amp-list]: could not find <amp-script> with script set to ${ampScriptId}`
        );
        return ampScriptEl
          .getImpl()
          .then((impl) => impl.callFunction(fnIdentifier));
      })
      .then((json) => {
        userAssert(
          typeof json === 'object',
          `[amp-list] ${src} must return json, but instead returned: ${typeof json}`
        );
        return json;
      });
  }

  /**
   * Given JSON payload data fetched from the server, modifies the
   * data according to developer-defined parameters. Extracts the correct
   * list items according to the 'items' attribute, asserts that this
   * contains an array or object, put object in an array if the single-item
   * attribute is set, and truncates the list-items to a length defined
   * by max-items.
   * @param {!JsonObject|!Array<JsonObject>} data
   * @throws {!Error} If response is undefined
   * @return {!Array}
   */
  computeListItems_(data) {
    const itemsExpr = this.element.getAttribute('items') || 'items';
    let items = data;
    if (itemsExpr != '.') {
      items = getValueForExpr(/**@type {!JsonObject}*/ (data), itemsExpr);
    }
    userAssert(
      typeof items !== 'undefined',
      'Response must contain an array or object at "%s". %s',
      itemsExpr,
      this.element
    );
    if (this.element.hasAttribute('single-item')) {
      if (!isArray(items)) {
        items = [items];
      } else {
        user().warn(
          TAG,
          'Expected response to contain a non-array Object due to "single-item" attribute.',
          this.element
        );
      }
    }
    items = user().assertArray(items);
    if (this.element.hasAttribute('max-items')) {
      items = this.truncateToMaxLen_(items);
    }
    return items;
  }

  /**
   * Schedules a fetch result to be rendered in the near future.
   * @param {!Array|!JsonObject|undefined} data
   * @param {boolean=} opt_append
   * @param {JsonObject|Array<JsonObject>=} opt_payload
   * @return {!Promise}
   * @private
   */
  scheduleRender_(data, opt_append, opt_payload) {
    const deferred = new Deferred();
    const {promise, resolve: resolver, reject: rejecter} = deferred;

    // If there's nothing currently being rendered, schedule a render pass.
    if (!this.renderItems_) {
      this.renderPass_.schedule();
    }

    this.renderItems_ = /** @type {?RenderItems} */ ({
      data,
      resolver,
      rejecter,
      append: opt_append,
      payload: opt_payload,
    });

    if (this.renderedItems_ && opt_append) {
      this.renderItems_.payload = /** @type {(?JsonObject|Array<JsonObject>)} */ (opt_payload ||
        {});
    }

    return promise;
  }

  /**
   * Renders the items stored in `this.renderItems_`. If its value changes
   * by the time render completes, schedules another render pass.
   * @private
   */
  doRenderPass_() {
    const current = this.renderItems_;

    user().warn(TAG, 'Rendering list', this.element, 'with data', current.data);

    devAssert(current && current.data, 'Nothing to render.');
    const scheduleNextPass = () => {
      // If there's a new `renderItems_`, schedule it for render.
      if (this.renderItems_ !== current) {
        this.renderPass_.schedule(1); // Allow paint frame before next render.
      } else {
        this.renderedItems_ = /** @type {?Array} */ (this.renderItems_.data);
        this.renderItems_ = null;
      }
    };
    const onFulfilledCallback = () => {
      scheduleNextPass();
      current.resolver();
    };
    const onRejectedCallback = () => {
      scheduleNextPass();
      current.rejecter();
    };
    // const isSSR = this.ssrTemplateHelper_.isEnabled();
    // let renderPromise = this.ssrTemplateHelper_
    //   .applySsrOrCsrTemplate(this.element, current.data)
    //   .then((result) => this.updateBindings_(result, current.append))
    //   .then((elements) => this.render_(elements, current.append));
    // if (!isSSR) {
    //   const payload = /** @type {!JsonObject} */ (current.payload);
    //   renderPromise = renderPromise.then(() =>
    //     this.maybeRenderLoadMoreTemplates_(payload)
    //   );
    // }
    // renderPromise.then(onFulfilledCallback, onRejectedCallback);
    Promise.resolve().then(onFulfilledCallback).catch(onRejectedCallback);
  }
}

AMP.extension(TAG, '0.1', (AMP) => {
  AMP.registerElement(TAG, AmpRender, CSS);
});
