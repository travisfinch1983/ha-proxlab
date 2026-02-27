/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const L = globalThis, V = L.ShadowRoot && (L.ShadyCSS === void 0 || L.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, N = Symbol(), G = /* @__PURE__ */ new WeakMap();
let nt = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== N) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (V && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = G.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && G.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const gt = (r) => new nt(typeof r == "string" ? r : r + "", void 0, N), F = (r, ...t) => {
  const e = r.length === 1 ? r[0] : t.reduce((i, a, s) => i + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(a) + r[s + 1], r[0]);
  return new nt(e, r, N);
}, ft = (r, t) => {
  if (V) r.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), a = L.litNonce;
    a !== void 0 && i.setAttribute("nonce", a), i.textContent = e.cssText, r.appendChild(i);
  }
}, K = V ? (r) => r : (r) => r instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return gt(e);
})(r) : r;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: _t, defineProperty: vt, getOwnPropertyDescriptor: mt, getOwnPropertyNames: bt, getOwnPropertySymbols: xt, getPrototypeOf: yt } = Object, v = globalThis, Y = v.trustedTypes, $t = Y ? Y.emptyScript : "", wt = v.reactiveElementPolyfillSupport, k = (r, t) => r, R = { toAttribute(r, t) {
  switch (t) {
    case Boolean:
      r = r ? $t : null;
      break;
    case Object:
    case Array:
      r = r == null ? r : JSON.stringify(r);
  }
  return r;
}, fromAttribute(r, t) {
  let e = r;
  switch (t) {
    case Boolean:
      e = r !== null;
      break;
    case Number:
      e = r === null ? null : Number(r);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(r);
      } catch {
        e = null;
      }
  }
  return e;
} }, dt = (r, t) => !_t(r, t), Z = { attribute: !0, type: String, converter: R, reflect: !1, useDefault: !1, hasChanged: dt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), v.litPropertyMetadata ?? (v.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let $ = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = Z) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), a = this.getPropertyDescriptor(t, i, e);
      a !== void 0 && vt(this.prototype, t, a);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: a, set: s } = mt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(n) {
      this[e] = n;
    } };
    return { get: a, set(n) {
      const c = a?.call(this);
      s?.call(this, n), this.requestUpdate(t, c, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Z;
  }
  static _$Ei() {
    if (this.hasOwnProperty(k("elementProperties"))) return;
    const t = yt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(k("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(k("properties"))) {
      const e = this.properties, i = [...bt(e), ...xt(e)];
      for (const a of i) this.createProperty(a, e[a]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, a] of e) this.elementProperties.set(i, a);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const a = this._$Eu(e, i);
      a !== void 0 && this._$Eh.set(a, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const a of i) e.unshift(K(a));
    } else t !== void 0 && e.push(K(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return ft(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    const i = this.constructor.elementProperties.get(t), a = this.constructor._$Eu(t, i);
    if (a !== void 0 && i.reflect === !0) {
      const s = (i.converter?.toAttribute !== void 0 ? i.converter : R).toAttribute(e, i.type);
      this._$Em = t, s == null ? this.removeAttribute(a) : this.setAttribute(a, s), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, a = i._$Eh.get(t);
    if (a !== void 0 && this._$Em !== a) {
      const s = i.getPropertyOptions(a), n = typeof s.converter == "function" ? { fromAttribute: s.converter } : s.converter?.fromAttribute !== void 0 ? s.converter : R;
      this._$Em = a;
      const c = n.fromAttribute(e, s.type);
      this[a] = c ?? this._$Ej?.get(a) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, a = !1, s) {
    if (t !== void 0) {
      const n = this.constructor;
      if (a === !1 && (s = this[t]), i ?? (i = n.getPropertyOptions(t)), !((i.hasChanged ?? dt)(s, e) || i.useDefault && i.reflect && s === this._$Ej?.get(t) && !this.hasAttribute(n._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: a, wrapped: s }, n) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, n ?? e ?? this[t]), s !== !0 || n !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), a === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [a, s] of this._$Ep) this[a] = s;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [a, s] of i) {
        const { wrapped: n } = s, c = this[a];
        n !== !0 || this._$AL.has(a) || c === void 0 || this.C(a, void 0, s, c);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(e)) : this._$EM();
    } catch (i) {
      throw t = !1, this._$EM(), i;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
$.elementStyles = [], $.shadowRootOptions = { mode: "open" }, $[k("elementProperties")] = /* @__PURE__ */ new Map(), $[k("finalized")] = /* @__PURE__ */ new Map(), wt?.({ ReactiveElement: $ }), (v.reactiveElementVersions ?? (v.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const S = globalThis, J = (r) => r, I = S.trustedTypes, X = I ? I.createPolicy("lit-html", { createHTML: (r) => r }) : void 0, lt = "$lit$", _ = `lit$${Math.random().toFixed(9).slice(2)}$`, ct = "?" + _, Ct = `<${ct}>`, y = document, P = () => y.createComment(""), M = (r) => r === null || typeof r != "object" && typeof r != "function", j = Array.isArray, At = (r) => j(r) || typeof r?.[Symbol.iterator] == "function", H = `[ 	
\f\r]`, A = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, tt = /-->/g, et = />/g, b = RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), it = /'/g, at = /"/g, ht = /^(?:script|style|textarea|title)$/i, kt = (r) => (t, ...e) => ({ _$litType$: r, strings: t, values: e }), o = kt(1), w = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), st = /* @__PURE__ */ new WeakMap(), x = y.createTreeWalker(y, 129);
function pt(r, t) {
  if (!j(r) || !r.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return X !== void 0 ? X.createHTML(t) : t;
}
const St = (r, t) => {
  const e = r.length - 1, i = [];
  let a, s = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", n = A;
  for (let c = 0; c < e; c++) {
    const l = r[c];
    let h, u, p = -1, g = 0;
    for (; g < l.length && (n.lastIndex = g, u = n.exec(l), u !== null); ) g = n.lastIndex, n === A ? u[1] === "!--" ? n = tt : u[1] !== void 0 ? n = et : u[2] !== void 0 ? (ht.test(u[2]) && (a = RegExp("</" + u[2], "g")), n = b) : u[3] !== void 0 && (n = b) : n === b ? u[0] === ">" ? (n = a ?? A, p = -1) : u[1] === void 0 ? p = -2 : (p = n.lastIndex - u[2].length, h = u[1], n = u[3] === void 0 ? b : u[3] === '"' ? at : it) : n === at || n === it ? n = b : n === tt || n === et ? n = A : (n = b, a = void 0);
    const f = n === b && r[c + 1].startsWith("/>") ? " " : "";
    s += n === A ? l + Ct : p >= 0 ? (i.push(h), l.slice(0, p) + lt + l.slice(p) + _ + f) : l + _ + (p === -2 ? c : f);
  }
  return [pt(r, s + (r[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class z {
  constructor({ strings: t, _$litType$: e }, i) {
    let a;
    this.parts = [];
    let s = 0, n = 0;
    const c = t.length - 1, l = this.parts, [h, u] = St(t, e);
    if (this.el = z.createElement(h, i), x.currentNode = this.el.content, e === 2 || e === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (a = x.nextNode()) !== null && l.length < c; ) {
      if (a.nodeType === 1) {
        if (a.hasAttributes()) for (const p of a.getAttributeNames()) if (p.endsWith(lt)) {
          const g = u[n++], f = a.getAttribute(p).split(_), U = /([.?@])?(.*)/.exec(g);
          l.push({ type: 1, index: s, name: U[2], strings: f, ctor: U[1] === "." ? Pt : U[1] === "?" ? Mt : U[1] === "@" ? zt : O }), a.removeAttribute(p);
        } else p.startsWith(_) && (l.push({ type: 6, index: s }), a.removeAttribute(p));
        if (ht.test(a.tagName)) {
          const p = a.textContent.split(_), g = p.length - 1;
          if (g > 0) {
            a.textContent = I ? I.emptyScript : "";
            for (let f = 0; f < g; f++) a.append(p[f], P()), x.nextNode(), l.push({ type: 2, index: ++s });
            a.append(p[g], P());
          }
        }
      } else if (a.nodeType === 8) if (a.data === ct) l.push({ type: 2, index: s });
      else {
        let p = -1;
        for (; (p = a.data.indexOf(_, p + 1)) !== -1; ) l.push({ type: 7, index: s }), p += _.length - 1;
      }
      s++;
    }
  }
  static createElement(t, e) {
    const i = y.createElement("template");
    return i.innerHTML = t, i;
  }
}
function C(r, t, e = r, i) {
  if (t === w) return t;
  let a = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const s = M(t) ? void 0 : t._$litDirective$;
  return a?.constructor !== s && (a?._$AO?.(!1), s === void 0 ? a = void 0 : (a = new s(r), a._$AT(r, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = a : e._$Cl = a), a !== void 0 && (t = C(r, a._$AS(r, t.values), a, i)), t;
}
class Et {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, a = (t?.creationScope ?? y).importNode(e, !0);
    x.currentNode = a;
    let s = x.nextNode(), n = 0, c = 0, l = i[0];
    for (; l !== void 0; ) {
      if (n === l.index) {
        let h;
        l.type === 2 ? h = new T(s, s.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(s, l.name, l.strings, this, t) : l.type === 6 && (h = new Tt(s, this, t)), this._$AV.push(h), l = i[++c];
      }
      n !== l?.index && (s = x.nextNode(), n++);
    }
    return x.currentNode = y, a;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class T {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, a) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = a, this._$Cv = a?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && t?.nodeType === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = C(this, t, e), M(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : At(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== d && M(this._$AH) ? this._$AA.nextSibling.data = t : this.T(y.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, a = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = z.createElement(pt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === a) this._$AH.p(e);
    else {
      const s = new Et(a, this), n = s.u(this.options);
      s.p(e), this.T(n), this._$AH = s;
    }
  }
  _$AC(t) {
    let e = st.get(t.strings);
    return e === void 0 && st.set(t.strings, e = new z(t)), e;
  }
  k(t) {
    j(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, a = 0;
    for (const s of t) a === e.length ? e.push(i = new T(this.O(P()), this.O(P()), this, this.options)) : i = e[a], i._$AI(s), a++;
    a < e.length && (this._$AR(i && i._$AB.nextSibling, a), e.length = a);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = J(t).nextSibling;
      J(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class O {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, a, s) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = e, this._$AM = a, this.options = s, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = d;
  }
  _$AI(t, e = this, i, a) {
    const s = this.strings;
    let n = !1;
    if (s === void 0) t = C(this, t, e, 0), n = !M(t) || t !== this._$AH && t !== w, n && (this._$AH = t);
    else {
      const c = t;
      let l, h;
      for (t = s[0], l = 0; l < s.length - 1; l++) h = C(this, c[i + l], e, l), h === w && (h = this._$AH[l]), n || (n = !M(h) || h !== this._$AH[l]), h === d ? t = d : t !== d && (t += (h ?? "") + s[l + 1]), this._$AH[l] = h;
    }
    n && !a && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Pt extends O {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class Mt extends O {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class zt extends O {
  constructor(t, e, i, a, s) {
    super(t, e, i, a, s), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = C(this, t, e, 0) ?? d) === w) return;
    const i = this._$AH, a = t === d && i !== d || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, s = t !== d && (i === d || a);
    a && this.element.removeEventListener(this.name, this, i), s && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Tt {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    C(this, t);
  }
}
const Ut = S.litHtmlPolyfillSupport;
Ut?.(z, T), (S.litHtmlVersions ?? (S.litHtmlVersions = [])).push("3.3.2");
const Lt = (r, t, e) => {
  const i = e?.renderBefore ?? t;
  let a = i._$litPart$;
  if (a === void 0) {
    const s = e?.renderBefore ?? null;
    i._$litPart$ = a = new T(t.insertBefore(P(), s), s, void 0, e ?? {});
  }
  return a._$AI(r), a;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const E = globalThis;
class m extends $ {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Lt(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return w;
  }
}
m._$litElement$ = !0, m.finalized = !0, E.litElementHydrateSupport?.({ LitElement: m });
const It = E.litElementPolyfillSupport;
It?.({ LitElement: m });
(E.litElementVersions ?? (E.litElementVersions = [])).push("4.2.2");
const Ot = F`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --card-secondary: var(--secondary-text-color, #727272);
    --accent: var(--primary-color, #7c3aed);
    --accent-text: var(--text-primary-color, #fff);
    --divider: var(--divider-color, rgba(0, 0, 0, 0.12));
    --user-bubble: var(--primary-color, #7c3aed);
    --user-text: var(--text-primary-color, #fff);
    --assistant-bubble: var(--secondary-background-color, #f5f5f5);
    --assistant-text: var(--primary-text-color, #212121);
    --input-bg: var(--card-background-color, #fff);
    --input-border: var(--divider-color, rgba(0, 0, 0, 0.12));
    --shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
  }

  .card-container {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  /* Portrait layout: avatar panel on left + chat area on right */
  .card-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .portrait-panel {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    padding: 8px;
    border-right: 1px solid var(--divider);
    background: var(--card-bg);
    overflow: hidden;
  }

  /* Auto mode: full image visible, no cropping */
  .portrait-panel .portrait-img-contain {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
    object-position: top;
    border-radius: 12px;
  }

  /* Manual mode: image fills width, overflows/crops at bottom (shows face) */
  .portrait-panel .portrait-img-cover {
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
    object-position: top;
    border-radius: 12px;
  }

  .portrait-name {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--card-text);
    text-align: center;
    word-break: break-word;
    flex-shrink: 0;
  }

  .portrait-status {
    font-size: 11px;
    color: var(--card-secondary);
    text-align: center;
    flex-shrink: 0;
  }

  .portrait-agent {
    font-size: 10px;
    color: var(--card-secondary);
    text-align: center;
    opacity: 0.7;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider);
    background: var(--card-bg);
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-text);
    font-size: 18px;
    font-weight: 600;
    flex-shrink: 0;
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .header-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--card-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-status {
    font-size: 12px;
    color: var(--card-secondary);
  }

  /* Messages area */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar {
    width: 4px;
  }

  .messages::-webkit-scrollbar-thumb {
    background: var(--divider);
    border-radius: 2px;
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message.user {
    align-self: flex-end;
  }

  .message.assistant {
    align-self: flex-start;
  }

  .bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message.user .bubble {
    background: var(--user-bubble);
    color: var(--user-text);
    border-bottom-right-radius: 4px;
  }

  .message.assistant .bubble {
    background: var(--assistant-bubble);
    color: var(--assistant-text);
    border-bottom-left-radius: 4px;
  }

  .meta {
    font-size: 11px;
    color: var(--card-secondary);
    margin-top: 2px;
    padding: 0 4px;
  }

  .message.user .meta {
    text-align: right;
  }

  /* Message action buttons (edit, regenerate) */
  .msg-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .message:hover .msg-actions {
    opacity: 1;
  }

  .message.user .msg-actions {
    justify-content: flex-end;
  }

  .meta-inline {
    font-size: 11px;
    color: var(--card-secondary);
    margin-right: 4px;
  }

  .msg-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--card-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.15s, color 0.15s;
  }

  .msg-btn:hover {
    background: var(--divider);
    color: var(--card-text);
  }

  .msg-btn.confirm {
    color: #22c55e;
  }

  .msg-btn.confirm:hover {
    background: rgba(34, 197, 94, 0.15);
  }

  .msg-btn.delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  .msg-btn.speak:hover {
    color: var(--accent);
    background: rgba(124, 58, 237, 0.15);
  }

  .msg-btn.speaking {
    color: var(--accent);
    animation: pulse 1.5s infinite;
  }

  /* Text formatting classes */
  .text-narration {
    font-style: italic;
    color: var(--narration-color, #9e9e9e);
  }

  .text-speech {
    color: var(--speech-color, #f59e0b);
  }

  .text-thoughts {
    font-style: italic;
    font-weight: 600;
    color: var(--thoughts-color, #a855f7);
  }

  /* Inline edit mode */
  .edit-bubble {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .message.editing {
    max-width: 100%;
    align-self: stretch;
  }

  .edit-textarea {
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    line-height: 1.4;
    font-family: inherit;
    background: transparent;
    color: var(--card-text);
    outline: none;
    resize: vertical;
    min-height: 96px;
    max-height: 300px;
    width: 100%;
    box-sizing: border-box;
  }

  .edit-actions {
    display: flex;
    gap: 4px;
  }

  .message.user .edit-actions {
    justify-content: flex-end;
  }

  /* Typing indicator */
  .typing {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    align-self: flex-start;
  }

  .typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--card-secondary);
    animation: bounce 1.4s infinite ease-in-out;
  }

  .typing-dot:nth-child(1) { animation-delay: -0.32s; }
  .typing-dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Input bar */
  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--divider);
    background: var(--input-bg);
  }

  .input-bar input {
    flex: 1;
    border: 1px solid var(--input-border);
    border-radius: 20px;
    padding: 8px 14px;
    font-size: 14px;
    background: transparent;
    color: var(--card-text);
    outline: none;
    transition: border-color 0.2s;
  }

  .input-bar input:focus {
    border-color: var(--accent);
  }

  .input-bar input::placeholder {
    color: var(--card-secondary);
  }

  .btn-icon {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, opacity 0.2s;
    flex-shrink: 0;
    padding: 0;
  }

  .btn-send {
    background: var(--accent);
    color: var(--accent-text);
  }

  .btn-send:hover {
    opacity: 0.85;
  }

  .btn-send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-mic {
    background: transparent;
    color: var(--card-secondary);
  }

  .btn-mic:hover {
    background: var(--divider);
  }

  .btn-mic.recording {
    color: #ef4444;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    color: var(--card-secondary);
    padding: 24px;
    text-align: center;
  }

  .empty-state .icon {
    font-size: 32px;
    opacity: 0.5;
  }

  /* Not configured state */
  .not-configured {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: var(--card-secondary);
    font-size: 14px;
    text-align: center;
  }
`, ut = F`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --card-secondary: var(--secondary-text-color, #727272);
    --accent: var(--primary-color, #7c3aed);
    --divider: var(--divider-color, rgba(0, 0, 0, 0.12));
  }

  .editor {
    padding: 16px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--divider);
    margin-bottom: 16px;
    overflow-x: auto;
  }

  .tab {
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--card-secondary);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab:hover:not(.disabled) {
    color: var(--card-text);
  }

  .tab.disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 12px;
    font-weight: 500;
    color: var(--card-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field input,
  .field select,
  .field textarea {
    border: 1px solid var(--divider);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    background: transparent;
    color: var(--card-text);
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--accent);
  }

  .field textarea {
    min-height: 80px;
    resize: vertical;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .toggle-row label {
    font-size: 14px;
    color: var(--card-text);
    text-transform: none;
    letter-spacing: 0;
  }

  .toggle-row .sublabel {
    font-size: 12px;
    color: var(--card-secondary);
  }

  /* Simple toggle switch */
  .switch {
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: var(--divider);
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .slider::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 2px;
    bottom: 2px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .switch input:checked + .slider {
    background: var(--accent);
  }

  .switch input:checked + .slider::before {
    transform: translateX(18px);
  }

  /* Avatar preview */
  .avatar-preview {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--divider);
  }

  .avatar-upload {
    display: flex;
    align-items: center;
    gap: 12px;
  }
`, Ht = F`
  :host {
    --card-bg: var(--card-background-color, #fff);
    --card-text: var(--primary-text-color, #212121);
    --accent: var(--primary-color, #7c3aed);
    --user-bubble: var(--accent);
    --user-text: #fff;
    --agent-bubble: var(--secondary-background-color, #f5f5f5);
    --agent-text: var(--card-text);
    --input-bg: var(--card-bg);
    --divider: var(--divider-color, #e5e7eb);
    --meta-color: var(--secondary-text-color, #999);
    display: block;
    font-family: var(--ha-card-font-family, inherit);
  }

  ha-card {
    overflow: hidden;
    background: var(--card-bg);
    color: var(--card-text);
  }

  .card-container {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Participant strip */
  .participant-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--divider);
    overflow-x: auto;
    flex-shrink: 0;
  }

  .participant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .participant-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }

  .participant-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--divider);
    font-weight: 600;
    font-size: 14px;
    color: var(--meta-color);
  }

  .participant-name {
    font-size: 11px;
    font-weight: 500;
    max-width: 60px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .participant-mode {
    margin-left: auto;
    flex-shrink: 0;
  }

  .mode-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 10px;
    background: var(--accent);
    color: white;
    white-space: nowrap;
  }

  /* Messages area */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    opacity: 0.5;
    font-size: 13px;
  }

  .msg {
    display: flex;
    max-width: 85%;
  }

  .msg-user {
    align-self: flex-end;
  }

  .agent-msg {
    align-self: flex-start;
    gap: 8px;
  }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    margin-top: 18px;
  }

  .msg-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--divider);
    font-weight: 600;
    font-size: 12px;
    color: var(--meta-color);
  }

  .agent-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .msg-name {
    font-size: 11px;
    font-weight: 600;
    padding-left: 2px;
  }

  .bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .user-bubble {
    background: var(--user-bubble);
    color: var(--user-text);
    border-bottom-right-radius: 4px;
  }

  .agent-bubble {
    background: var(--agent-bubble);
    color: var(--agent-text);
    border-bottom-left-radius: 4px;
  }

  .msg-meta {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: var(--meta-color);
    padding-left: 4px;
  }

  /* Text formatting (SillyTavern-style) */
  .text-narration { font-style: italic; opacity: 0.8; }
  .text-speech { color: var(--speech-color, #f59e0b); }
  .text-thoughts { font-style: italic; font-weight: 600; opacity: 0.7; }

  /* Loading indicator */
  .loading-row {
    display: flex;
    justify-content: center;
    padding: 8px;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 14px;
    background: var(--agent-bubble);
    border-radius: 12px;
  }

  .typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--meta-color);
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-4px); }
  }

  /* Input bar */
  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--divider);
    flex-shrink: 0;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
  }

  .input-wrapper input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--divider);
    border-radius: 20px;
    background: var(--input-bg);
    color: var(--card-text);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .input-wrapper input:focus {
    border-color: var(--accent);
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    opacity: 0.85;
  }

  /* @mention dropdown */
  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--card-bg);
    border: 1px solid var(--divider);
    border-radius: 8px;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
    max-height: 160px;
    overflow-y: auto;
    z-index: 10;
    margin-bottom: 4px;
  }

  .mention-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
  }

  .mention-item:hover {
    background: var(--agent-bubble);
  }

  .mention-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .mention-avatar.placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--divider);
    font-weight: 600;
    font-size: 11px;
  }
`;
function D(r) {
  const t = [];
  let e = 0, i = "";
  const a = () => {
    i && (t.push({ type: "normal", text: i }), i = "");
  };
  for (; e < r.length; ) {
    if (r[e] === "`" && r.slice(e, e + 3) === "```") {
      const s = r.indexOf("```", e + 3);
      if (s !== -1) {
        a(), t.push({ type: "thoughts", text: r.slice(e + 3, s) }), e = s + 3;
        continue;
      }
    }
    if (r[e] === "*") {
      const s = r.indexOf("*", e + 1);
      if (s !== -1) {
        a(), t.push({ type: "narration", text: r.slice(e + 1, s) }), e = s + 1;
        continue;
      }
    }
    if (r[e] === '"') {
      const s = r.indexOf('"', e + 1);
      if (s !== -1) {
        a(), t.push({ type: "speech", text: r.slice(e + 1, s) }), e = s + 1;
        continue;
      }
    }
    i += r[e], e++;
  }
  return a(), t;
}
const rt = {
  card_id: "",
  agent_id: "conversation_agent",
  prompt_override: "",
  avatar: "",
  tts_voices: { normal: "", narration: "", speech: "", thoughts: "" },
  auto_tts: !1,
  stt_enabled: !1,
  personality_enabled: !1,
  personality: {
    name: "",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator_notes: ""
  },
  per_card_memory: !1,
  allowed_users: [],
  show_metadata: !0,
  card_height: 500,
  customize_enabled: !1,
  title_override: "",
  status_override: "",
  hide_header: !1,
  portrait_width: "auto",
  use_profile: !1,
  profile_id: ""
};
class B extends m {
  constructor() {
    super(...arguments), this._cardConfig = { ...rt }, this._tab = "general", this._agents = [], this._voices = [], this._profiles = [], this._loaded = !1, this._defaultPrompt = "";
  }
  setConfig(t) {
    this._config = t, this._loaded = !1;
  }
  async willUpdate() {
    this.hass && this._config?.card_id && !this._loaded && (this._loaded = !0, await this._loadData());
  }
  async _loadData() {
    try {
      const [t, e, i, a] = await Promise.all([
        this.hass.callWS({
          type: "proxlab/card/config/get",
          card_id: this._config.card_id
        }),
        this.hass.callWS({ type: "proxlab/agent/available" }),
        this.hass.callWS({ type: "proxlab/card/voices" }),
        this.hass.callWS({ type: "proxlab/profile/list" })
      ]);
      if (t) {
        const s = t;
        typeof s.tts_voice == "string" && !s.tts_voices && (t.tts_voices = {
          normal: s.tts_voice,
          narration: "",
          speech: "",
          thoughts: ""
        }, delete t.tts_voice), t.tts_voices || (t.tts_voices = { normal: "", narration: "", speech: "", thoughts: "" }), t.use_profile === void 0 && (t.use_profile = !1), t.profile_id || (t.profile_id = ""), this._cardConfig = t;
      } else
        this._cardConfig = { ...rt, card_id: this._config.card_id };
      this._agents = e || [], this._voices = i || [], this._profiles = a || [], this._cardConfig.use_profile || this._loadAgentPrompt(this._cardConfig.agent_id);
    } catch {
    }
  }
  async _loadAgentPrompt(t) {
    try {
      const e = await this.hass.callWS({
        type: "proxlab/card/agent_prompt",
        agent_id: t
      });
      this._defaultPrompt = e?.prompt ?? "";
    } catch {
      this._defaultPrompt = "";
    }
  }
  render() {
    return o`
      <div class="editor">
        <div class="tabs">
          ${[
      { id: "general", label: "General" },
      { id: "voice", label: "Voice" },
      { id: "advanced", label: "Advanced" }
    ].map(
      (e) => o`
              <button
                class="tab ${this._tab === e.id ? "active" : ""}"
                @click=${() => {
        this._tab = e.id;
      }}
              >
                ${e.label}
              </button>
            `
    )}
        </div>
        <div class="tab-content">
          ${this._tab === "general" ? this._renderGeneralTab() : d}
          ${this._tab === "voice" ? this._renderVoiceTab() : d}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : d}
        </div>
      </div>
    `;
  }
  // ---- Tabs ----
  _renderGeneralTab() {
    const t = this._cardConfig.use_profile;
    return o`
      <!-- Mode toggle -->
      <div class="toggle-row" style="margin-bottom: 8px;">
        <div>
          <label>Use Agent Profile</label>
          <div class="sublabel">Link this card to a saved agent profile from the Profiles tab</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${t}
            @change=${(e) => {
      this._updateField("use_profile", e.target.checked);
    }}
          />
          <span class="slider"></span>
        </label>
      </div>

      ${t ? this._renderProfileMode() : this._renderDefaultMode()}
    `;
  }
  _renderProfileMode() {
    const t = this._profiles.find(
      (e) => e.profile_id === this._cardConfig.profile_id
    );
    return o`
      <!-- Profile selector -->
      <div class="field">
        <label>Agent Profile</label>
        <select
          .value=${this._cardConfig.profile_id}
          @change=${(e) => {
      this._updateField("profile_id", e.target.value);
    }}
        >
          <option value="">Select a profile...</option>
          ${this._profiles.map(
      (e) => o`<option value=${e.profile_id} ?selected=${this._cardConfig.profile_id === e.profile_id}>
              ${e.name}${e.personality_enabled && e.personality?.name ? ` (${e.personality.name})` : ""}
            </option>`
    )}
        </select>
      </div>

      ${t ? o`
            <!-- Profile preview -->
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: var(--secondary-background-color, #f5f5f5); margin-top: 4px;">
              ${t.avatar ? o`<img src="${t.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />` : o`<div style="width: 48px; height: 48px; border-radius: 50%; background: var(--divider-color, #e5e7eb); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 18px;">${t.name.charAt(0).toUpperCase()}</div>`}
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 14px;">${t.name}</div>
                <div style="font-size: 12px; opacity: 0.6;">${t.connection_id ? `Connection: ${t.connection_id}` : `Agent: ${t.agent_id}`}</div>
                ${t.personality_enabled ? o`<div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">Character: ${t.personality?.name || "Unnamed"}</div>` : d}
              </div>
            </div>
            <div style="font-size: 11px; opacity: 0.5; margin-top: 8px; padding: 0 2px;">
              All agent settings are managed in the ProxLab panel under Agents → Profiles.
              Changes made there will be reflected on all cards using this profile.
            </div>
          ` : d}

      ${this._profiles.length === 0 ? o`
            <div style="text-align: center; padding: 16px; opacity: 0.5; font-size: 13px;">
              <p>No profiles found.</p>
              <p style="margin-top: 4px;">Create profiles in the ProxLab panel under Agents → Profiles.</p>
            </div>
          ` : d}

      <!-- Card-level display overrides (not profile fields) -->
      <div style="border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 12px; padding-top: 12px;">
        <div class="field">
          <label>Title Override</label>
          <input
            type="text"
            placeholder="Default: profile/character name"
            .value=${this._cardConfig.title_override}
            @input=${(e) => this._updateField("title_override", e.target.value)}
          />
        </div>
        <div class="field">
          <label>Status Override</label>
          <input
            type="text"
            placeholder="Default: Online"
            .value=${this._cardConfig.status_override}
            @input=${(e) => this._updateField("status_override", e.target.value)}
          />
        </div>
        <div class="field">
          <label>Card Height (px)</label>
          <input
            type="number"
            min="200"
            max="1200"
            .value=${String(this._cardConfig.card_height)}
            @input=${(e) => this._updateField("card_height", parseInt(e.target.value) || 500)}
          />
        </div>
        <div class="toggle-row">
          <div>
            <label>Hide Header</label>
            <div class="sublabel">Hide the title bar</div>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              .checked=${this._cardConfig.hide_header}
              @change=${(e) => this._updateField("hide_header", e.target.checked)}
            />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  }
  _renderDefaultMode() {
    return o`
      <div class="field">
        <label>Agent</label>
        <select
          .value=${this._cardConfig.agent_id}
          @change=${(t) => {
      const e = t.target.value;
      this._updateField("agent_id", e), this._loadAgentPrompt(e);
    }}
        >
          <option value="orchestrator" ?selected=${this._cardConfig.agent_id === "orchestrator"}>
            Orchestrator (Default Pipeline)
          </option>
          <option value="conversation_agent" ?selected=${this._cardConfig.agent_id === "conversation_agent"}>
            Conversation Agent
          </option>
          ${this._agents.map(
      (t) => o`<option value=${t.agent_id} ?selected=${this._cardConfig.agent_id === t.agent_id}>
              ${t.name}
            </option>`
    )}
        </select>
      </div>
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar ? o`<img class="avatar-preview" src="${this._cardConfig.avatar}" />` : o`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
          <input type="file" accept="image/*" @change=${this._onAvatarUpload} />
        </div>
      </div>
      <div class="field">
        <label>Title Override</label>
        <input
          type="text"
          placeholder="Default: agent/personality name"
          .value=${this._cardConfig.title_override}
          @input=${(t) => this._updateField("title_override", t.target.value)}
        />
      </div>
      <div class="field">
        <label>Status Override</label>
        <input
          type="text"
          placeholder="Default: Online"
          .value=${this._cardConfig.status_override}
          @input=${(t) => this._updateField("status_override", t.target.value)}
        />
      </div>
      <div class="field">
        <label>Card Height (px)</label>
        <input
          type="number"
          min="200"
          max="1200"
          .value=${String(this._cardConfig.card_height)}
          @input=${(t) => this._updateField("card_height", parseInt(t.target.value) || 500)}
        />
      </div>
      <div class="field">
        <label>Portrait Width</label>
        <select
          .value=${String(this._cardConfig.portrait_width ?? "auto")}
          @change=${(t) => {
      const e = t.target.value;
      this._updateField("portrait_width", e === "auto" ? "auto" : parseInt(e));
    }}
        >
          <option value="auto" ?selected=${this._cardConfig.portrait_width === "auto"}>Auto (fit to card height)</option>
          <option value="150" ?selected=${this._cardConfig.portrait_width === 150}>150px</option>
          <option value="200" ?selected=${this._cardConfig.portrait_width === 200}>200px</option>
          <option value="250" ?selected=${this._cardConfig.portrait_width === 250}>250px</option>
          <option value="300" ?selected=${this._cardConfig.portrait_width === 300}>300px</option>
          <option value="350" ?selected=${this._cardConfig.portrait_width === 350}>350px</option>
          <option value="400" ?selected=${this._cardConfig.portrait_width === 400}>400px</option>
        </select>
        <div class="sublabel" style="font-size:11px;color:var(--card-secondary);margin-top:2px">
          Auto: full image visible. Manual: fills width, crops bottom (focuses on face).
        </div>
      </div>
      <div class="toggle-row">
        <div>
          <label>Hide Header</label>
          <div class="sublabel">Hide the title bar (portrait panel still shows if avatar set)</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.hide_header}
            @change=${(t) => this._updateField("hide_header", t.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }
  _renderVoiceTab() {
    if (this._cardConfig.use_profile) {
      const i = this._profiles.find(
        (a) => a.profile_id === this._cardConfig.profile_id
      );
      if (i) {
        const a = i.tts_voices || { normal: "", narration: "", speech: "", thoughts: "" }, s = (n) => this._voices.find((c) => c.id === n)?.name ?? n ?? "None";
        return o`
          <div style="padding: 4px 0; opacity: 0.7; font-size: 13px;">
            Voice settings are managed by the linked profile. Edit in Agents → Profiles.
          </div>
          <div class="field">
            <label>Normal: <strong>${s(a.normal)}</strong></label>
          </div>
          <div class="field">
            <label>Narration: <strong>${s(a.narration)}</strong></label>
          </div>
          <div class="field">
            <label>Speech: <strong>${s(a.speech)}</strong></label>
          </div>
          <div class="field">
            <label>Thoughts: <strong>${s(a.thoughts)}</strong></label>
          </div>
          <div class="field">
            <label>Auto TTS: <strong>${i.auto_tts ? "On" : "Off"}</strong></label>
          </div>
        `;
      }
      return o`<div style="opacity: 0.5; padding: 12px;">Select an agent profile first.</div>`;
    }
    const t = this._cardConfig.tts_voices ?? { normal: "", narration: "", speech: "", thoughts: "" }, e = (i, a, s) => o`
      <div class="field">
        <label>${i}</label>
        <div class="sublabel" style="font-size:11px;color:var(--card-secondary);margin-bottom:2px">${a}</div>
        <select
          .value=${t[s]}
          @change=${(n) => {
      const c = n.target.value;
      this._updateField("tts_voices", { ...t, [s]: c });
    }}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
      (n) => o`<option value=${n.id} ?selected=${t[s] === n.id}>
              ${n.name}
            </option>`
    )}
        </select>
      </div>
    `;
    return o`
      <div class="toggle-row">
        <div>
          <label>Auto TTS</label>
          <div class="sublabel">Automatically voice all agent responses</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.auto_tts ?? !1}
            @change=${(i) => this._updateField("auto_tts", i.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      ${e("Normal Text", "Voice for unformatted text", "normal")}
      ${e("Narration", "Voice for *narration* text", "narration")}
      ${e("Speech", 'Voice for "speech" text', "speech")}
      ${e("Thoughts", "Voice for ```thoughts``` text", "thoughts")}
    `;
  }
  _renderAdvancedTab() {
    return o`
      <div class="toggle-row">
        <div>
          <label>Per-Card Memory</label>
          <div class="sublabel">Create a separate Milvus collection for this card's conversations</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.per_card_memory}
            @change=${(t) => this._updateField("per_card_memory", t.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="toggle-row">
        <div>
          <label>Show Metadata</label>
          <div class="sublabel">Display model, tokens, and timing on messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.show_metadata}
            @change=${(t) => this._updateField("show_metadata", t.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="field">
        <label>Card ID</label>
        <input type="text" .value=${this._cardConfig.card_id} disabled />
      </div>
    `;
  }
  // ---- Actions ----
  _updateField(t, e) {
    this._cardConfig = { ...this._cardConfig, [t]: e }, this._saveAndFireEvent();
  }
  async _saveAndFireEvent() {
    if (this.hass && this._config?.card_id)
      try {
        await this.hass.callWS({
          type: "proxlab/card/config/save",
          card_id: this._config.card_id,
          config: this._cardConfig
        });
      } catch {
      }
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: !0,
        composed: !0
      })
    );
  }
  async _onAvatarUpload(t) {
    const e = t.target.files?.[0];
    if (!e || !this.hass || !this._config?.card_id) return;
    const i = new FileReader();
    i.onloadend = async () => {
      const a = i.result.split(",")[1];
      try {
        const n = (await this.hass.callWS({
          type: "proxlab/card/avatar/upload",
          card_id: this._config.card_id,
          data: a,
          filename: e.name
        })).url.split("?")[0] + "?v=" + Date.now();
        this._updateField("avatar", n);
      } catch {
      }
    }, i.readAsDataURL(e);
  }
}
B.styles = ut;
B.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _tab: { state: !0 },
  _agents: { state: !0 },
  _voices: { state: !0 },
  _profiles: { state: !0 },
  _loaded: { state: !0 },
  _defaultPrompt: { state: !0 }
};
customElements.define("proxlab-chat-card-editor", B);
class W extends m {
  constructor() {
    super(...arguments), this._cardConfig = {
      card_id: "",
      profile_ids: [],
      turn_mode: "round_robin",
      card_height: 600,
      show_metadata: !1,
      allowed_users: []
    }, this._profiles = [], this._loaded = !1, this._tab = "participants";
  }
  setConfig(t) {
    this._config = t, this._loaded = !1;
  }
  async willUpdate(t) {
    this.hass && this._config?.card_id && !this._loaded && (this._loaded = !0, await this._loadData());
  }
  async _loadData() {
    try {
      const [t, e] = await Promise.all([
        this.hass.callWS({
          type: "proxlab/group/config/get",
          card_id: this._config.card_id
        }),
        this.hass.callWS({
          type: "proxlab/profile/list"
        })
      ]);
      this._profiles = e || [], t ? this._cardConfig = t : this._cardConfig = {
        ...this._cardConfig,
        card_id: this._config.card_id
      };
    } catch {
    }
  }
  render() {
    return o`
      <div class="editor">
        <div class="tabs">
          ${[
      ["participants", "Participants"],
      ["settings", "Settings"]
    ].map(
      ([t, e]) => o`
              <button
                class="tab ${this._tab === t ? "active" : ""}"
                @click=${() => {
        this._tab = t;
      }}
              >
                ${e}
              </button>
            `
    )}
        </div>
        <div class="tab-content">
          ${this._tab === "participants" ? this._renderParticipantsTab() : d}
          ${this._tab === "settings" ? this._renderSettingsTab() : d}
        </div>
      </div>
    `;
  }
  _renderParticipantsTab() {
    if (this._profiles.length === 0)
      return o`
        <div style="padding: 16px; text-align: center; opacity: 0.6;">
          <p>No agent profiles found.</p>
          <p style="font-size: 12px; margin-top: 8px;">
            Create profiles in the ProxLab panel under Agents → Profiles,
            or use "Save as Profile" in a chat card's Advanced tab.
          </p>
        </div>
      `;
    const t = new Set(this._cardConfig.profile_ids);
    return o`
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="sublabel" style="margin-bottom: 4px;">
          Select agent profiles to participate in this group chat.
          Order determines turn sequence for Round Robin mode.
        </div>
        ${this._profiles.map(
      (e) => o`
            <label
              class="profile-row"
              style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid ${t.has(e.profile_id) ? "var(--primary-color, #7c3aed)" : "var(--divider, #e5e7eb)"}; background: ${t.has(e.profile_id) ? "var(--primary-color, #7c3aed)11" : "transparent"};"
            >
              <input
                type="checkbox"
                .checked=${t.has(e.profile_id)}
                @change=${(i) => this._toggleProfile(
        e.profile_id,
        i.target.checked
      )}
                style="accent-color: var(--primary-color, #7c3aed);"
              />
              ${e.avatar ? o`<img
                    src="${e.avatar}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                  />` : o`<div
                    style="width: 32px; height: 32px; border-radius: 50%; background: var(--divider, #e5e7eb); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;"
                  >
                    ${e.name.charAt(0).toUpperCase()}
                  </div>`}
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; font-size: 13px;">${e.name}</div>
                <div style="font-size: 11px; opacity: 0.6;">${e.agent_id}</div>
              </div>
            </label>
          `
    )}
      </div>
    `;
  }
  _renderSettingsTab() {
    return o`
      <div class="field">
        <label>Turn Mode</label>
        <select
          .value=${this._cardConfig.turn_mode}
          @change=${(t) => this._updateField(
      "turn_mode",
      t.target.value
    )}
        >
          <option value="round_robin">Round Robin — each agent responds in order</option>
          <option value="all_respond">All Respond — agents respond in parallel</option>
          <option value="at_mention">@Mention — only mentioned agents respond</option>
        </select>
      </div>

      <div class="field">
        <label>Card Height (px)</label>
        <input
          type="number"
          min="300"
          max="1200"
          .value=${String(this._cardConfig.card_height)}
          @change=${(t) => this._updateField(
      "card_height",
      parseInt(t.target.value) || 600
    )}
        />
      </div>

      <div class="toggle-row">
        <div>
          <label>Show Metadata</label>
          <div class="sublabel">Display model, tokens, and timing on agent messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.show_metadata}
            @change=${(t) => this._updateField(
      "show_metadata",
      t.target.checked
    )}
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="field">
        <label>Card ID</label>
        <input type="text" .value=${this._cardConfig.card_id} disabled />
      </div>
    `;
  }
  _toggleProfile(t, e) {
    let i = [...this._cardConfig.profile_ids];
    e ? i.includes(t) || i.push(t) : i = i.filter((a) => a !== t), this._updateField("profile_ids", i);
  }
  _updateField(t, e) {
    this._cardConfig = { ...this._cardConfig, [t]: e }, this._saveAndFireEvent();
  }
  async _saveAndFireEvent() {
    if (this.hass && this._config?.card_id)
      try {
        await this.hass.callWS({
          type: "proxlab/group/config/save",
          card_id: this._config.card_id,
          config: this._cardConfig
        });
      } catch {
      }
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: !0,
        composed: !0
      })
    );
  }
}
W.styles = ut;
W.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _profiles: { state: !0 },
  _loaded: { state: !0 },
  _tab: { state: !0 }
};
customElements.define(
  "proxlab-group-chat-card-editor",
  W
);
const Rt = o`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, ot = [250, 160, 30, 340, 200, 80, 290, 120];
class Q extends m {
  constructor() {
    super(...arguments), this._profiles = [], this._messages = [], this._loading = !1, this._inputValue = "", this._configLoaded = !1, this._mentionOpen = !1, this._mentionFilter = "";
  }
  setConfig(t) {
    if (!t.card_id)
      throw new Error("Please set a card_id in the card configuration");
    this._config = t, this._configLoaded = !1;
  }
  static getConfigElement() {
    return document.createElement("proxlab-group-chat-card-editor");
  }
  static getStubConfig() {
    return {
      type: "custom:proxlab-group-chat-card",
      card_id: Math.random().toString(36).substring(2, 10)
    };
  }
  getCardSize() {
    return Math.max(3, Math.ceil((this._cardConfig?.card_height ?? 600) / 50));
  }
  getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_min_columns: 3,
      grid_rows: "auto",
      grid_min_rows: 3
    };
  }
  willUpdate(t) {
    t.has("hass") && this.hass && this._config?.card_id && !this._configLoaded && (this._configLoaded = !0, this._loadConfig());
  }
  async _loadConfig() {
    try {
      const [t, e] = await Promise.all([
        this.hass.callWS({
          type: "proxlab/group/config/get",
          card_id: this._config.card_id
        }),
        this.hass.callWS({
          type: "proxlab/profile/list"
        })
      ]);
      t ? (this._cardConfig = t, this._profiles = t.profile_ids.map((i) => e.find((a) => a.profile_id === i)).filter((i) => !!i)) : (this._cardConfig = {
        card_id: this._config.card_id,
        profile_ids: [],
        turn_mode: "round_robin",
        card_height: 600,
        show_metadata: !1,
        allowed_users: []
      }, this._profiles = []);
    } catch {
    }
  }
  render() {
    if (!this._cardConfig)
      return o`<ha-card>
        <div style="padding: 24px; text-align: center;">
          <span style="opacity: 0.5;">Loading group chat...</span>
        </div>
      </ha-card>`;
    const t = this._cardConfig.card_height ?? 600;
    return o`
      <ha-card>
        <div class="card-container" style="height: ${t}px;">
          ${this._renderParticipantStrip()}
          <div class="messages" id="messages">
            ${this._messages.length === 0 ? o`<div class="empty-state">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  <span>Start a group conversation</span>
                </div>` : this._messages.map((e) => this._renderMessage(e))}
            ${this._loading ? o`<div class="loading-row">
                  <div class="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>` : d}
          </div>
          <div class="input-bar">
            <div class="input-wrapper">
              <input
                type="text"
                placeholder="${this._cardConfig.turn_mode === "at_mention" ? "Type @name to mention an agent..." : "Type a message..."}"
                .value=${this._inputValue}
                @input=${this._onInput}
                @keydown=${(e) => {
      e.key === "Enter" && !e.shiftKey && (e.preventDefault(), this._sendMessage());
    }}
                ?disabled=${this._loading}
              />
              ${this._renderMentionDropdown()}
            </div>
            <button
              class="send-btn"
              @click=${this._sendMessage}
              ?disabled=${this._loading || !this._inputValue.trim()}
            >
              ${Rt}
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }
  _renderParticipantStrip() {
    return this._profiles.length === 0 ? o`<div class="participant-strip">
        <span style="opacity: 0.5; font-size: 12px;">No participants — configure profiles in card editor</span>
      </div>` : o`
      <div class="participant-strip">
        ${this._profiles.map(
      (t) => o`
            <div class="participant">
              ${t.avatar ? o`<img class="participant-avatar" src="${t.avatar}" alt="${t.name}" />` : o`<div class="participant-avatar placeholder">${t.name.charAt(0).toUpperCase()}</div>`}
              <span class="participant-name">${t.name}</span>
            </div>
          `
    )}
        <div class="participant-mode">
          <span class="mode-badge">${this._turnModeLabel()}</span>
        </div>
      </div>
    `;
  }
  _turnModeLabel() {
    switch (this._cardConfig?.turn_mode) {
      case "round_robin":
        return "Round Robin";
      case "all_respond":
        return "All Respond";
      case "at_mention":
        return "@Mention";
      default:
        return "";
    }
  }
  _renderMessage(t) {
    if (t.role === "user")
      return o`
        <div class="msg msg-user">
          <div class="bubble user-bubble">${this._formatContent(t.content)}</div>
        </div>
      `;
    const e = this._profiles.findIndex(
      (a) => a.profile_id === t.profile_id
    ), i = ot[e >= 0 ? e % ot.length : 0];
    return o`
      <div class="msg agent-msg">
        ${t.avatar ? o`<img class="msg-avatar" src="${t.avatar}" alt="${t.profile_name}" />` : o`<div class="msg-avatar placeholder">${(t.profile_name ?? "?").charAt(0).toUpperCase()}</div>`}
        <div class="agent-body">
          <span class="msg-name" style="color: hsl(${i}, 60%, 55%);">${t.profile_name}</span>
          <div class="bubble agent-bubble" style="border-left: 3px solid hsl(${i}, 60%, 55%);">
            ${this._formatContent(t.content)}
          </div>
          ${this._cardConfig?.show_metadata && t.metadata ? o`<div class="msg-meta">
                ${t.metadata.model ? o`<span>${t.metadata.model}</span>` : d}
                ${t.metadata.tokens ? o`<span>${t.metadata.tokens} tok</span>` : d}
                ${t.metadata.duration_ms ? o`<span>${(t.metadata.duration_ms / 1e3).toFixed(1)}s</span>` : d}
              </div>` : d}
        </div>
      </div>
    `;
  }
  _formatContent(t) {
    return D(t).map((i) => i.type === "normal" ? o`<span>${i.text}</span>` : o`<span class="text-${i.type}">${i.text}</span>`);
  }
  _onInput(t) {
    const e = t.target;
    this._inputValue = e.value;
    const i = e.value.lastIndexOf("@");
    if (i >= 0 && this._cardConfig?.turn_mode === "at_mention") {
      const a = e.value.slice(i + 1);
      if (!a.includes(" ")) {
        this._mentionOpen = !0, this._mentionFilter = a.toLowerCase();
        return;
      }
    }
    this._mentionOpen = !1;
  }
  _renderMentionDropdown() {
    if (!this._mentionOpen || this._profiles.length === 0) return d;
    const t = this._profiles.filter(
      (e) => e.name.toLowerCase().includes(this._mentionFilter)
    );
    return t.length === 0 ? d : o`
      <div class="mention-dropdown">
        ${t.map(
      (e) => o`
            <div
              class="mention-item"
              @click=${() => this._completeMention(e.name)}
            >
              ${e.avatar ? o`<img src="${e.avatar}" class="mention-avatar" />` : o`<span class="mention-avatar placeholder">${e.name.charAt(0)}</span>`}
              <span>${e.name}</span>
            </div>
          `
    )}
      </div>
    `;
  }
  _completeMention(t) {
    const e = this._inputValue.lastIndexOf("@");
    e >= 0 && (this._inputValue = this._inputValue.slice(0, e) + "@" + t + " "), this._mentionOpen = !1, this.shadowRoot?.querySelector("input")?.focus();
  }
  async _sendMessage() {
    const t = this._inputValue.trim();
    if (!(!t || !this._config?.card_id || this._loading)) {
      this._messages = [
        ...this._messages,
        { role: "user", content: t, timestamp: Date.now() }
      ], this._inputValue = "", this._loading = !0, this._scrollToBottom();
      try {
        const e = await this.hass.callWS({
          type: "proxlab/group/invoke",
          card_id: this._config.card_id,
          message: t
        });
        if (e.responses) {
          const i = e.responses.map((a) => ({
            role: "assistant",
            content: a.response_text,
            timestamp: Date.now(),
            profile_id: a.profile_id,
            profile_name: a.profile_name,
            avatar: a.avatar,
            metadata: {
              tokens: a.tokens,
              duration_ms: a.duration_ms,
              model: a.model
            }
          }));
          this._messages = [...this._messages, ...i];
          for (const a of e.responses) {
            if (!a.success) continue;
            const s = this._profiles.find(
              (n) => n.profile_id === a.profile_id
            );
            s?.auto_tts && s.tts_voices?.normal && this._speakForProfile(a.response_text, s);
          }
        }
      } catch (e) {
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: `Error: ${e}`,
            timestamp: Date.now(),
            profile_name: "System"
          }
        ];
      } finally {
        this._loading = !1, this._scrollToBottom();
      }
    }
  }
  async _speakForProfile(t, e) {
    const i = e.tts_voices?.normal;
    if (i)
      try {
        await this.hass.callWS({
          type: "proxlab/card/tts/speak",
          text: t,
          voice: i
        });
      } catch {
      }
  }
  _scrollToBottom() {
    requestAnimationFrame(() => {
      const t = this.shadowRoot?.getElementById("messages");
      t && (t.scrollTop = t.scrollHeight);
    });
  }
}
Q.styles = Ht;
Q.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _profiles: { state: !0 },
  _messages: { state: !0 },
  _loading: { state: !0 },
  _inputValue: { state: !0 },
  _configLoaded: { state: !0 },
  _mentionOpen: { state: !0 },
  _mentionFilter: { state: !0 }
};
customElements.define("proxlab-group-chat-card", Q);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-group-chat-card",
  name: "ProxLab Group Chat",
  description: "Multi-agent group chat card",
  preview: !1
});
const Dt = o`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, Vt = o`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`, Nt = o`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`, Ft = o`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`, jt = o`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`, Bt = o`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`, Wt = o`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`, Qt = o`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`, qt = o`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
class q extends m {
  constructor() {
    super(...arguments), this._messages = [], this._loading = !1, this._inputValue = "", this._recording = !1, this._configLoaded = !1, this._portraitWidth = 0, this._editingIndex = -1, this._editValue = "", this._speakingIndex = -1, this._audioChunks = [], this._lastAvatarUrl = "", this._audioQueue = [], this._audioPlaying = !1, this._onAudioQueueDone = null;
  }
  // ---- Lovelace lifecycle ----
  setConfig(t) {
    if (!t.card_id)
      throw new Error("Please set a card_id in the card configuration");
    this._config = t, this._configLoaded = !1;
  }
  static getConfigElement() {
    return document.createElement("proxlab-chat-card-editor");
  }
  static getStubConfig() {
    return {
      type: "custom:proxlab-chat-card",
      card_id: Math.random().toString(36).substring(2, 10)
    };
  }
  getCardSize() {
    return Math.max(3, Math.ceil((this._cardConfig?.card_height ?? 500) / 50));
  }
  getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_min_columns: 3,
      grid_rows: "auto",
      grid_min_rows: 3
    };
  }
  // ---- Reactive updates ----
  willUpdate(t) {
    t.has("hass") && this._config && !this._configLoaded && this._loadCardConfig();
  }
  async _loadCardConfig() {
    if (!(!this.hass || !this._config?.card_id)) {
      this._configLoaded = !0;
      try {
        const t = await this.hass.callWS({
          type: "proxlab/card/config/get",
          card_id: this._config.card_id
        });
        if (!t) {
          this._cardConfig = void 0;
          return;
        }
        if (t.use_profile && t.profile_id)
          try {
            const e = await this.hass.callWS({
              type: "proxlab/profile/get",
              profile_id: t.profile_id
            });
            e && (t.avatar = e.avatar || t.avatar, t.personality_enabled = e.personality_enabled, t.personality = e.personality, t.prompt_override = e.prompt_override, t.agent_id = e.agent_id, t.tts_voices = e.tts_voices, t.auto_tts = e.auto_tts, t.portrait_width = e.portrait_width, !t.title_override && e.personality?.name ? t.title_override = e.personality.name : !t.title_override && e.name && (t.title_override = e.name));
          } catch {
          }
        this._cardConfig = t, t.avatar && t.avatar !== this._lastAvatarUrl && (this._lastAvatarUrl = t.avatar, this._measureAvatar(t.avatar, t.card_height ?? 500)), this._messages.length === 0 && t.personality_enabled && t.personality?.first_mes && (this._messages = [
          {
            role: "assistant",
            content: t.personality.first_mes,
            timestamp: Date.now()
          }
        ]);
      } catch {
      }
    }
  }
  _measureAvatar(t, e) {
    const i = new Image();
    i.onload = () => {
      if (!i.naturalWidth || !i.naturalHeight) return;
      const a = e - 56 - 52 - 16 - 36, s = i.naturalWidth / i.naturalHeight, n = Math.round(a * s);
      this._portraitWidth = Math.max(80, Math.min(n, 600));
    }, i.src = t;
  }
  // ---- Rendering ----
  render() {
    if (!this._config)
      return o`<ha-card><div class="not-configured">No configuration</div></ha-card>`;
    if (this._cardConfig?.allowed_users?.length) {
      const c = this.hass?.user?.id;
      if (c && !this._cardConfig.allowed_users.includes(c))
        return o``;
    }
    const t = this._cardConfig?.card_height ?? 500, e = this._cardConfig?.hide_header ?? !1, i = this._cardConfig?.avatar, a = !!i, s = this._resolveTitle(), n = this._resolveStatus();
    return o`
      <ha-card>
        <div class="card-container" style="height: ${t}px">
          ${e ? d : this._renderHeader(s, n, i)}
          ${a ? o`
                <div class="card-layout">
                  ${this._renderPortraitPanel(i, s, n)}
                  <div class="chat-area">
                    ${this._renderMessages()}
                    ${this._renderInputBar()}
                  </div>
                </div>
              ` : o`
                ${this._renderMessages()}
                ${this._renderInputBar()}
              `}
        </div>
      </ha-card>
    `;
  }
  _resolveTitle() {
    return this._cardConfig?.title_override ? this._cardConfig.title_override : this._cardConfig?.personality_enabled && this._cardConfig?.personality?.name ? this._cardConfig.personality.name : "ProxLab Chat";
  }
  _resolveStatus() {
    return this._cardConfig?.status_override ? this._cardConfig.status_override : this._loading ? "Thinking..." : "Online";
  }
  _resolveAgentLabel() {
    const t = this._cardConfig?.agent_id;
    return t ? t === "orchestrator" ? "Orchestrator" : t === "conversation_agent" ? "Conversation Agent" : t.replace(/_/g, " ").replace(/\b\w/g, (e) => e.toUpperCase()) : "";
  }
  _renderHeader(t, e, i) {
    return o`
      <div class="card-header">
        <div class="avatar">
          ${i ? o`<img src="${i}" alt="${t}" />` : t.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${t}</div>
          <div class="header-status">${e}</div>
        </div>
      </div>
    `;
  }
  _renderPortraitPanel(t, e, i) {
    const a = this._cardConfig?.portrait_width ?? "auto", s = typeof a == "number" && a > 0, n = s ? a : this._portraitWidth, c = n ? `width: ${n}px; max-width: 50%;` : "width: 25%; max-width: 50%;", l = s ? "portrait-img-cover" : "portrait-img-contain", h = this._resolveAgentLabel();
    return o`
      <div class="portrait-panel" style="${c}">
        <img class="${l}" src="${t}" alt="${e}" />
        <div class="portrait-name">${e}</div>
        <div class="portrait-status">${i}</div>
        ${h ? o`<div class="portrait-agent">${h}</div>` : d}
      </div>
    `;
  }
  _renderMessages() {
    if (this._messages.length === 0 && !this._loading)
      return o`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${Nt}
            <span>Start a conversation</span>
          </div>
        </div>
      `;
    const t = this._findLastAssistantIndex();
    return o`
      <div class="messages">
        ${this._messages.map(
      (e, i) => o`
            <div class="message ${e.role} ${this._editingIndex === i ? "editing" : ""}">
              ${this._editingIndex === i ? this._renderEditBubble(i) : o`
                    <div class="bubble">${this._formatContent(e.content)}</div>
                    <div class="msg-actions">
                      ${this._cardConfig?.show_metadata !== !1 && e.metadata ? o`<span class="meta-inline">
                            ${e.metadata.model ?? ""}${e.metadata.tokens ? ` | ${e.metadata.tokens} tok` : ""}${e.metadata.duration_ms ? ` | ${(e.metadata.duration_ms / 1e3).toFixed(1)}s` : ""}
                          </span>` : d}
                      ${this._loading ? d : o`
                            <button class="msg-btn" title="Edit" @click=${() => this._startEdit(i)}>
                              ${Ft}
                            </button>
                            <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(i)}>
                              ${Qt}
                            </button>
                            ${e.role === "assistant" ? o`<button
                                  class="msg-btn speak ${this._speakingIndex === i ? "speaking" : ""}"
                                  title="Speak"
                                  @click=${() => this._speakMessage(i)}
                                >
                                  ${qt}
                                </button>` : d}
                            ${e.role === "assistant" && i === t ? o`<button class="msg-btn" title="Regenerate" @click=${() => this._regenerate()}>
                                  ${jt}
                                </button>` : d}
                          `}
                    </div>
                  `}
            </div>
          `
    )}
        ${this._loading ? o`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>` : d}
      </div>
    `;
  }
  _renderEditBubble(t) {
    return o`
      <div class="edit-bubble">
        <textarea
          class="edit-textarea"
          .value=${this._editValue}
          @input=${(e) => {
      this._editValue = e.target.value;
    }}
          @keydown=${(e) => {
      e.key === "Enter" && !e.shiftKey && (e.preventDefault(), this._confirmEdit(t)), e.key === "Escape" && this._cancelEdit();
    }}
        ></textarea>
        <div class="edit-actions">
          <button class="msg-btn confirm" title="Save" @click=${() => this._confirmEdit(t)}>
            ${Bt}
          </button>
          <button class="msg-btn" title="Cancel" @click=${() => this._cancelEdit()}>
            ${Wt}
          </button>
        </div>
      </div>
    `;
  }
  _findLastAssistantIndex() {
    for (let t = this._messages.length - 1; t >= 0; t--)
      if (this._messages[t].role === "assistant") return t;
    return -1;
  }
  _renderInputBar() {
    return o`
      <div class="input-bar">
        <button
          class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
          @click=${this._toggleRecording}
          title="Voice input"
        >
          ${Vt}
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          .value=${this._inputValue}
          @input=${(t) => {
      this._inputValue = t.target.value;
    }}
          @keydown=${(t) => {
      t.key === "Enter" && !t.shiftKey && (t.preventDefault(), this._sendMessage());
    }}
          ?disabled=${this._loading}
        />
        <button
          class="btn-icon btn-send"
          @click=${this._sendMessage}
          ?disabled=${this._loading || !this._inputValue.trim()}
          title="Send"
        >
          ${Dt}
        </button>
      </div>
    `;
  }
  // ---- Edit & Regenerate ----
  _startEdit(t) {
    this._editingIndex = t, this._editValue = this._messages[t].content;
  }
  _cancelEdit() {
    this._editingIndex = -1, this._editValue = "";
  }
  _confirmEdit(t) {
    const e = this._editValue.trim();
    if (!e) return;
    const i = [...this._messages];
    i[t] = { ...this._messages[t], content: e }, this._messages = i, this._editingIndex = -1, this._editValue = "";
  }
  async _regenerate() {
    if (this._loading || !this.hass || !this._config?.card_id) return;
    let t = -1;
    for (let e = this._messages.length - 1; e >= 0; e--)
      if (this._messages[e].role === "user") {
        t = e;
        break;
      }
    t < 0 || (this._messages = this._messages.slice(0, t + 1), this._resendFromIndex(t));
  }
  async _resendFromIndex(t) {
    const e = this._messages[t].content;
    if (!(!e || !this.hass || !this._config?.card_id)) {
      this._loading = !0, this._scrollToBottom();
      try {
        const i = await this.hass.callWS({
          type: "proxlab/card/invoke",
          card_id: this._config.card_id,
          message: e,
          conversation_id: `card_${this._config.card_id}`
        });
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: i.response_text || "No response",
            timestamp: Date.now(),
            metadata: {
              agent_name: i.agent_name,
              tokens: i.tokens,
              duration_ms: i.duration_ms,
              model: i.model,
              tool_results: i.tool_results
            }
          }
        ], this._cardConfig?.auto_tts && this._speakSegments(i.response_text || "");
      } catch (i) {
        const a = i instanceof Error ? i.message : String(i);
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: `Error: ${a}`,
            timestamp: Date.now()
          }
        ];
      } finally {
        this._loading = !1, this._scrollToBottom();
      }
    }
  }
  // ---- Actions ----
  async _sendMessage() {
    const t = this._inputValue.trim();
    if (!(!t || this._loading || !this.hass || !this._config?.card_id)) {
      this._messages = [
        ...this._messages,
        { role: "user", content: t, timestamp: Date.now() }
      ], this._inputValue = "", this._loading = !0, this._scrollToBottom();
      try {
        const e = await this.hass.callWS({
          type: "proxlab/card/invoke",
          card_id: this._config.card_id,
          message: t,
          conversation_id: `card_${this._config.card_id}`
        });
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: e.response_text || "No response",
            timestamp: Date.now(),
            metadata: {
              agent_name: e.agent_name,
              tokens: e.tokens,
              duration_ms: e.duration_ms,
              model: e.model,
              tool_results: e.tool_results
            }
          }
        ], this._cardConfig?.auto_tts && this._speakSegments(e.response_text || "");
      } catch (e) {
        const i = e instanceof Error ? e.message : String(e);
        this._messages = [
          ...this._messages,
          {
            role: "assistant",
            content: `Error: ${i}`,
            timestamp: Date.now()
          }
        ];
      } finally {
        this._loading = !1, this._scrollToBottom();
      }
    }
  }
  _scrollToBottom() {
    requestAnimationFrame(() => {
      const t = this.renderRoot?.querySelector(".messages");
      t && (t.scrollTop = t.scrollHeight);
    });
  }
  _formatContent(t) {
    return D(t).map((i) => i.type === "normal" ? o`<span>${i.text}</span>` : o`<span class="text-${i.type}">${i.text}</span>`);
  }
  _deleteMessage(t) {
    const e = [...this._messages];
    e.splice(t, 1), this._messages = e;
  }
  async _speakMessage(t) {
    const e = this._messages[t];
    !e || e.role !== "assistant" || (this._speakingIndex = t, await this._speakSegments(e.content, () => {
      this._speakingIndex = -1;
    }));
  }
  async _speakSegments(t, e) {
    const i = this._cardConfig?.tts_voices;
    if (!i) {
      e?.();
      return;
    }
    if (!(i.normal || i.narration || i.speech || i.thoughts) || !this.hass || !this._config?.card_id) {
      e?.();
      return;
    }
    const n = D(t).filter((c) => c.text.trim()).map((c) => ({ text: c.text, voice: i[c.type] || "" })).filter((c) => c.voice);
    if (n.length === 0) {
      e?.();
      return;
    }
    try {
      const c = await this.hass.callWS({
        type: "proxlab/card/tts/speak",
        card_id: this._config.card_id,
        segments: n
      });
      if (c?.audio_segments?.length) {
        for (const l of c.audio_segments) {
          const h = l.url || l.data_url;
          h && this._audioQueue.push(h);
        }
        this._onAudioQueueDone = e ?? null, this._playAudioQueue();
      } else
        e?.();
    } catch {
      e?.();
    }
  }
  _playAudioQueue() {
    if (this._audioPlaying || this._audioQueue.length === 0) {
      if (!this._audioPlaying && this._audioQueue.length === 0 && this._onAudioQueueDone) {
        const e = this._onAudioQueueDone;
        this._onAudioQueueDone = null, e();
      }
      return;
    }
    this._audioPlaying = !0;
    const t = this._audioQueue.shift();
    try {
      const e = new Audio(t);
      e.onended = () => {
        this._audioPlaying = !1, this._playAudioQueue();
      }, e.onerror = () => {
        this._audioPlaying = !1, this._playAudioQueue();
      }, e.play().catch(() => {
        this._audioPlaying = !1, this._playAudioQueue();
      });
    } catch {
      this._audioPlaying = !1, this._playAudioQueue();
    }
  }
  // ---- STT (Mic) ----
  async _toggleRecording() {
    if (this._recording) {
      this._mediaRecorder?.stop(), this._recording = !1;
      return;
    }
    try {
      const t = await navigator.mediaDevices.getUserMedia({ audio: !0 });
      this._audioChunks = [], this._mediaRecorder = new MediaRecorder(t), this._mediaRecorder.ondataavailable = (e) => {
        e.data.size > 0 && this._audioChunks.push(e.data);
      }, this._mediaRecorder.onstop = async () => {
        t.getTracks().forEach((i) => i.stop());
        const e = new Blob(this._audioChunks, { type: "audio/webm" });
        await this._transcribeAudio(e);
      }, this._mediaRecorder.start(), this._recording = !0;
    } catch {
    }
  }
  async _transcribeAudio(t) {
    try {
      const e = new FileReader(), i = await new Promise((s) => {
        e.onloadend = () => {
          const n = e.result;
          s(n.split(",")[1] || "");
        }, e.readAsDataURL(t);
      }), a = await this.hass.callWS({
        type: "proxlab/card/stt/transcribe",
        audio_data: i
      });
      a?.text && (this._inputValue = a.text);
    } catch {
    }
  }
}
q.styles = Ot;
q.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _messages: { state: !0 },
  _loading: { state: !0 },
  _inputValue: { state: !0 },
  _recording: { state: !0 },
  _configLoaded: { state: !0 },
  _portraitWidth: { state: !0 },
  _editingIndex: { state: !0 },
  _editValue: { state: !0 },
  _speakingIndex: { state: !0 }
};
customElements.define("proxlab-chat-card", q);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-chat-card",
  name: "ProxLab Chat",
  description: "Chat with ProxLab agents directly from your dashboard",
  preview: !0,
  documentationURL: "https://github.com/travisfinch1983/ha-proxlab"
});
export {
  q as ProxLabChatCard
};
