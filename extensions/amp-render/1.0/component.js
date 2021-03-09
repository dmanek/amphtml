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

import * as Preact from '../../../src/preact';
import {ContainWrapper} from '../../../src/preact/component';
import {useEffect, useState} from '../../../src/preact';
// import {useStyles} from './component.jss';

/**
 * @param {!RenderDef.Props} props
 * @return {PreactDef.Renderable}
 */
export function Render({src, fetchFn, ...rest}) {
  const [data, setData] = useState({});

  useEffect(() => {
    fetchFn(src).then((data) => {
      setData(data);
    });
  }, [src, fetchFn]);

  return (
    <ContainWrapper layout size paint {...rest}>
      amp render body
      {data}
    </ContainWrapper>
  );
}
