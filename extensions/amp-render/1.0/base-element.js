/**
 * Copyright 2021 The AMP HTML Authors. All Rights Reserved.
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

import {CSS as COMPONENT_CSS} from './component.jss';
import {PreactBaseElement} from '../../../src/preact/base-element';
import {Render} from './component';

export class BaseElement extends PreactBaseElement {}

/** @override */
BaseElement['Component'] = Render;

/** @override */
BaseElement['props'] = {
  'src': {attr: 'src'},
  'fetchFn': {attr: 'fetch-fn'},
  // 'credentials': {attr: 'credentials'},
  // 'xssi-prefix': {attr: 'xssiPrefix'},
  // 'binding': {attr: 'binding'},
};

/** @override */
BaseElement['usesTemplate'] = true;

/** @override */
BaseElement['lightDomTag'] = 'div';

/** @override */
// BaseElement['passthrough'] = true;
// BaseElement['passthroughNonEmpty'] = true;
// BaseElement['children'] = {};

/** @override */
BaseElement['layoutSizeDefined'] = true;

/** @override */
BaseElement['shadowCss'] = COMPONENT_CSS;