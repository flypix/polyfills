/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

import ApplyShim from '../src/apply-shim'
import templateMap from '../src/template-map'
import {getIsExtends} from '../src/style-util'
import * as ApplyShimUtils from '../src/apply-shim-utils'
import {getComputedStyleValue, updateNativeProperties} from '../src/common-utils'

/** @const {ApplyShim} */
const applyShim = new ApplyShim();

class ApplyShimInterface {
  constructor() {
    this.customStyleInterface = null;
    this.booted = false;
  }
  ensure() {
    if (this.booted) {
      return;
    }
    this.customStyleInterface = window['ShadyCSS']['CustomStyleInterface'];
    if (this.customStyleInterface) {
      this.customStyleInterface['transformCallback'] = (style) => {
        applyShim.transformCustomStyle(style);
      };
      this.customStyleInterface['validateCallback'] = () => {
        this.flushCustomStyles();
        if (ApplyShimUtils.elementsAreInvalid()) {
          this.styleDocument();
        }
      }
    }
    this.booted = true;
  }
  /**
   * @param {!HTMLTemplateElement} template
   * @param {string} elementName
   */
  prepareTemplate(template, elementName) {
    this.ensure();
    templateMap[elementName] = template;
    applyShim.transformTemplate(template, elementName);
  }
  flushCustomStyles() {
    this.ensure();
    if (this.customStyleInterface) {
      this.customStyleInterface['findStyles']();
      let styles = this.customStyleInterface['customStyles'];
      for (let i = 0; i < styles.length; i++ ) {
        let cs = styles[i];
        let style = this.customStyleInterface['getStyleForCustomStyle'](cs);
        if (style) {
          applyShim.transformCustomStyle(style);
        }
      }
      this.customStyleInterface['enqueued'] = false;
    }
  }
  /**
   * @param {Element} element
   * @param {Object=} properties
   */
  styleSubtree(element, properties) {
    this.ensure();
    if (properties) {
      updateNativeProperties(element, properties);
    }
    if (element.shadowRoot) {
      this.styleElement(element);
      let shadowChildren = element.shadowRoot.children || element.shadowRoot.childNodes;
      for (let i = 0; i < shadowChildren.length; i++) {
        this.styleSubtree(shadowChildren[i]);
      }
    }
    let children = element.children || element.childNodes;
    for (let i = 0; i < children.length; i++) {
      this.styleSubtree(children[i]);
    }
  }
  /**
   * @param {Element} element
   */
  styleElement(element) {
    this.ensure();
    let {is} = getIsExtends(element);
    let template = templateMap[is];
    if (template && !ApplyShimUtils.templateIsValid(template)) {
      // only revalidate template once
      if (!ApplyShimUtils.templateIsValidating(template)) {
        this.prepareTemplate(template, is);
        ApplyShimUtils.startValidatingTemplate(template);
      }
      // update all instances
      let root = element.shadowRoot;
      if (root) {
        let style = /** @type {HTMLStyleElement} */(root.querySelector('style'));
        if (style) {
          applyShim.transformStyle(style, is);
        }
      }
    }
  }
  /**
   * @param {Object=} properties
   */
  styleDocument(properties) {
    this.ensure();
    this.styleSubtree(document.documentElement, properties);
  }
}

const applyShimInterface = new ApplyShimInterface();

if (!window['ShadyCSS'] || !window['ShadyCSS']['ScopingShim']) {
  let CustomStyleInterface = window['ShadyCSS'] && window['ShadyCSS']['CustomStyleInterface'];

  window['ShadyCSS'] = {
    /**
     * @param {HTMLTemplateElement} template
     * @param {string} elementName
     * @param {string=} elementExtends
     */
    ['prepareTemplate'](template, elementName, elementExtends) { // eslint-disable-line no-unused-vars
      applyShimInterface.flushCustomStyles();
      applyShimInterface.prepareTemplate(template, elementName)
    },

    /**
     * @param {Element} element
     * @param {Object=} properties
     */
    ['styleSubtree'](element, properties) {
      applyShimInterface.flushCustomStyles();
      applyShimInterface.styleSubtree(element, properties);
    },

    /**
     * @param {Element} element
     */
    ['styleElement'](element) {
      applyShimInterface.flushCustomStyles();
      applyShimInterface.styleElement(element);
    },

    /**
     * @param {Object=} properties
     */
    ['styleDocument'](properties) {
      applyShimInterface.flushCustomStyles();
      applyShimInterface.styleDocument(properties);
    },

    /**
     * @param {Element} element
     * @param {string} property
     * @return {string}
     */
    ['getComputedStyleValue'](element, property) {
      return getComputedStyleValue(element, property);
    },
    ['nativeCss']: true,
    ['nativeShadow']: true
  };

  if (CustomStyleInterface) {
    window['ShadyCSS']['CustomStyleInterface'] = CustomStyleInterface;
  }
}

window['ShadyCSS']['ApplyShim'] = applyShim;