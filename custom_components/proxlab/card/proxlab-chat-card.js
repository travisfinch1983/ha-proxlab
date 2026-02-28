/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const B = globalThis, D = B.ShadowRoot && (B.ShadyCSS === void 0 || B.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, R = Symbol(), G = /* @__PURE__ */ new WeakMap();
let dt = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== R) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (D && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = G.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && G.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const ft = (n) => new dt(typeof n == "string" ? n : n + "", void 0, R), F = (n, ...t) => {
  const e = n.length === 1 ? n[0] : t.reduce((i, s, a) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[a + 1], n[0]);
  return new dt(e, n, R);
}, mt = (n, t) => {
  if (D) n.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = B.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, n.appendChild(i);
  }
}, K = D ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return ft(e);
})(n) : n;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: vt, defineProperty: bt, getOwnPropertyDescriptor: xt, getOwnPropertyNames: yt, getOwnPropertySymbols: $t, getPrototypeOf: wt } = Object, m = globalThis, Y = m.trustedTypes, kt = Y ? Y.emptyScript : "", Ct = m.reactiveElementPolyfillSupport, A = (n, t) => n, O = { toAttribute(n, t) {
  switch (t) {
    case Boolean:
      n = n ? kt : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, t) {
  let e = n;
  switch (t) {
    case Boolean:
      e = n !== null;
      break;
    case Number:
      e = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(n);
      } catch {
        e = null;
      }
  }
  return e;
} }, ct = (n, t) => !vt(n, t), Z = { attribute: !0, type: String, converter: O, reflect: !1, useDefault: !1, hasChanged: ct };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), m.litPropertyMetadata ?? (m.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let $ = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = Z) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && bt(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: a } = xt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: s, set(o) {
      const d = s?.call(this);
      a?.call(this, o), this.requestUpdate(t, d, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Z;
  }
  static _$Ei() {
    if (this.hasOwnProperty(A("elementProperties"))) return;
    const t = wt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(A("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(A("properties"))) {
      const e = this.properties, i = [...yt(e), ...$t(e)];
      for (const s of i) this.createProperty(s, e[s]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, s] of e) this.elementProperties.set(i, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const s = this._$Eu(e, i);
      s !== void 0 && this._$Eh.set(s, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const s of i) e.unshift(K(s));
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
    return mt(t, this.constructor.elementStyles), t;
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
    const i = this.constructor.elementProperties.get(t), s = this.constructor._$Eu(t, i);
    if (s !== void 0 && i.reflect === !0) {
      const a = (i.converter?.toAttribute !== void 0 ? i.converter : O).toAttribute(e, i.type);
      this._$Em = t, a == null ? this.removeAttribute(s) : this.setAttribute(s, a), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const a = i.getPropertyOptions(s), o = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : O;
      this._$Em = s;
      const d = o.fromAttribute(e, a.type);
      this[s] = d ?? this._$Ej?.get(s) ?? d, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, a) {
    if (t !== void 0) {
      const o = this.constructor;
      if (s === !1 && (a = this[t]), i ?? (i = o.getPropertyOptions(t)), !((i.hasChanged ?? ct)(a, e) || i.useDefault && i.reflect && a === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: a }, o) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), a !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
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
        for (const [s, a] of this._$Ep) this[s] = a;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, a] of i) {
        const { wrapped: o } = a, d = this[s];
        o !== !0 || this._$AL.has(s) || d === void 0 || this.C(s, void 0, a, d);
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
$.elementStyles = [], $.shadowRootOptions = { mode: "open" }, $[A("elementProperties")] = /* @__PURE__ */ new Map(), $[A("finalized")] = /* @__PURE__ */ new Map(), Ct?.({ ReactiveElement: $ }), (m.reactiveElementVersions ?? (m.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const S = globalThis, J = (n) => n, L = S.trustedTypes, X = L ? L.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, ht = "$lit$", f = `lit$${Math.random().toFixed(9).slice(2)}$`, pt = "?" + f, At = `<${pt}>`, y = document, P = () => y.createComment(""), M = (n) => n === null || typeof n != "object" && typeof n != "function", N = Array.isArray, St = (n) => N(n) || typeof n?.[Symbol.iterator] == "function", H = `[ 	
\f\r]`, C = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, tt = /-->/g, et = />/g, b = RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), it = /'/g, st = /"/g, ut = /^(?:script|style|textarea|title)$/i, Et = (n) => (t, ...e) => ({ _$litType$: n, strings: t, values: e }), r = Et(1), w = Symbol.for("lit-noChange"), c = Symbol.for("lit-nothing"), at = /* @__PURE__ */ new WeakMap(), x = y.createTreeWalker(y, 129);
function gt(n, t) {
  if (!N(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return X !== void 0 ? X.createHTML(t) : t;
}
const Pt = (n, t) => {
  const e = n.length - 1, i = [];
  let s, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = C;
  for (let d = 0; d < e; d++) {
    const l = n[d];
    let h, u, p = -1, g = 0;
    for (; g < l.length && (o.lastIndex = g, u = o.exec(l), u !== null); ) g = o.lastIndex, o === C ? u[1] === "!--" ? o = tt : u[1] !== void 0 ? o = et : u[2] !== void 0 ? (ut.test(u[2]) && (s = RegExp("</" + u[2], "g")), o = b) : u[3] !== void 0 && (o = b) : o === b ? u[0] === ">" ? (o = s ?? C, p = -1) : u[1] === void 0 ? p = -2 : (p = o.lastIndex - u[2].length, h = u[1], o = u[3] === void 0 ? b : u[3] === '"' ? st : it) : o === st || o === it ? o = b : o === tt || o === et ? o = C : (o = b, s = void 0);
    const _ = o === b && n[d + 1].startsWith("/>") ? " " : "";
    a += o === C ? l + At : p >= 0 ? (i.push(h), l.slice(0, p) + ht + l.slice(p) + f + _) : l + f + (p === -2 ? d : _);
  }
  return [gt(n, a + (n[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class T {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let a = 0, o = 0;
    const d = t.length - 1, l = this.parts, [h, u] = Pt(t, e);
    if (this.el = T.createElement(h, i), x.currentNode = this.el.content, e === 2 || e === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = x.nextNode()) !== null && l.length < d; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(ht)) {
          const g = u[o++], _ = s.getAttribute(p).split(f), I = /([.?@])?(.*)/.exec(g);
          l.push({ type: 1, index: a, name: I[2], strings: _, ctor: I[1] === "." ? Tt : I[1] === "?" ? zt : I[1] === "@" ? It : V }), s.removeAttribute(p);
        } else p.startsWith(f) && (l.push({ type: 6, index: a }), s.removeAttribute(p));
        if (ut.test(s.tagName)) {
          const p = s.textContent.split(f), g = p.length - 1;
          if (g > 0) {
            s.textContent = L ? L.emptyScript : "";
            for (let _ = 0; _ < g; _++) s.append(p[_], P()), x.nextNode(), l.push({ type: 2, index: ++a });
            s.append(p[g], P());
          }
        }
      } else if (s.nodeType === 8) if (s.data === pt) l.push({ type: 2, index: a });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(f, p + 1)) !== -1; ) l.push({ type: 7, index: a }), p += f.length - 1;
      }
      a++;
    }
  }
  static createElement(t, e) {
    const i = y.createElement("template");
    return i.innerHTML = t, i;
  }
}
function k(n, t, e = n, i) {
  if (t === w) return t;
  let s = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const a = M(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== a && (s?._$AO?.(!1), a === void 0 ? s = void 0 : (s = new a(n), s._$AT(n, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = s : e._$Cl = s), s !== void 0 && (t = k(n, s._$AS(n, t.values), s, i)), t;
}
class Mt {
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
    const { el: { content: e }, parts: i } = this._$AD, s = (t?.creationScope ?? y).importNode(e, !0);
    x.currentNode = s;
    let a = x.nextNode(), o = 0, d = 0, l = i[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let h;
        l.type === 2 ? h = new z(a, a.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(a, l.name, l.strings, this, t) : l.type === 6 && (h = new Bt(a, this, t)), this._$AV.push(h), l = i[++d];
      }
      o !== l?.index && (a = x.nextNode(), o++);
    }
    return x.currentNode = y, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class z {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, s) {
    this.type = 2, this._$AH = c, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
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
    t = k(this, t, e), M(t) ? t === c || t == null || t === "" ? (this._$AH !== c && this._$AR(), this._$AH = c) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : St(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== c && M(this._$AH) ? this._$AA.nextSibling.data = t : this.T(y.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = T.createElement(gt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const a = new Mt(s, this), o = a.u(this.options);
      a.p(e), this.T(o), this._$AH = a;
    }
  }
  _$AC(t) {
    let e = at.get(t.strings);
    return e === void 0 && at.set(t.strings, e = new T(t)), e;
  }
  k(t) {
    N(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const a of t) s === e.length ? e.push(i = new z(this.O(P()), this.O(P()), this, this.options)) : i = e[s], i._$AI(a), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
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
class V {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, a) {
    this.type = 1, this._$AH = c, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = c;
  }
  _$AI(t, e = this, i, s) {
    const a = this.strings;
    let o = !1;
    if (a === void 0) t = k(this, t, e, 0), o = !M(t) || t !== this._$AH && t !== w, o && (this._$AH = t);
    else {
      const d = t;
      let l, h;
      for (t = a[0], l = 0; l < a.length - 1; l++) h = k(this, d[i + l], e, l), h === w && (h = this._$AH[l]), o || (o = !M(h) || h !== this._$AH[l]), h === c ? t = c : t !== c && (t += (h ?? "") + a[l + 1]), this._$AH[l] = h;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === c ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Tt extends V {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === c ? void 0 : t;
  }
}
class zt extends V {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== c);
  }
}
class It extends V {
  constructor(t, e, i, s, a) {
    super(t, e, i, s, a), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = k(this, t, e, 0) ?? c) === w) return;
    const i = this._$AH, s = t === c && i !== c || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, a = t !== c && (i === c || s);
    s && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Bt {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    k(this, t);
  }
}
const Lt = S.litHtmlPolyfillSupport;
Lt?.(T, z), (S.litHtmlVersions ?? (S.litHtmlVersions = [])).push("3.3.2");
const Ut = (n, t, e) => {
  const i = e?.renderBefore ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const a = e?.renderBefore ?? null;
    i._$litPart$ = s = new z(t.insertBefore(P(), a), a, void 0, e ?? {});
  }
  return s._$AI(n), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const E = globalThis;
class v extends $ {
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
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Ut(e, this.renderRoot, this.renderOptions);
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
v._$litElement$ = !0, v.finalized = !0, E.litElementHydrateSupport?.({ LitElement: v });
const Vt = E.litElementPolyfillSupport;
Vt?.({ LitElement: v });
(E.litElementVersions ?? (E.litElementVersions = [])).push("4.2.2");
const Ht = F`
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

  /* Streaming cursor */
  .streaming-cursor::after {
    content: "\u258B";
    animation: blink 0.7s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
`, _t = F`
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
`, Ot = F`
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

  /* Message action buttons */
  .msg-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .msg:hover .msg-actions,
  .agent-msg:hover .msg-actions {
    opacity: 1;
  }

  .msg-user .msg-actions {
    justify-content: flex-end;
  }

  .meta-inline {
    font-size: 11px;
    color: var(--meta-color);
    margin-right: 4px;
  }

  .msg-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--meta-color);
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

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Inline edit mode */
  .edit-bubble {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .msg.editing,
  .agent-msg.editing {
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

  .msg-user .edit-actions {
    justify-content: flex-end;
  }

  /* Streaming cursor */
  .streaming-cursor::after {
    content: "\u258B";
    animation: blink 0.7s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

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
function U(n) {
  const t = [];
  let e = 0, i = "";
  const s = () => {
    i && (t.push({ type: "normal", text: i }), i = "");
  };
  for (; e < n.length; ) {
    if (n[e] === "`" && n.slice(e, e + 3) === "```") {
      const a = n.indexOf("```", e + 3);
      if (a !== -1) {
        s(), t.push({ type: "thoughts", text: n.slice(e + 3, a) }), e = a + 3;
        continue;
      }
    }
    if (n[e] === "*") {
      const a = n.indexOf("*", e + 1);
      if (a !== -1) {
        s(), t.push({ type: "narration", text: n.slice(e + 1, a) }), e = a + 1;
        continue;
      }
    }
    if (n[e] === '"') {
      const a = n.indexOf('"', e + 1);
      if (a !== -1) {
        s(), t.push({ type: "speech", text: n.slice(e + 1, a) }), e = a + 1;
        continue;
      }
    }
    i += n[e], e++;
  }
  return s(), t;
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
  profile_id: "",
  streaming_enabled: !1
};
class j extends v {
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
      const [t, e, i, s] = await Promise.all([
        this.hass.callWS({
          type: "proxlab/card/config/get",
          card_id: this._config.card_id
        }),
        this.hass.callWS({ type: "proxlab/agent/available" }),
        this.hass.callWS({ type: "proxlab/card/voices" }),
        this.hass.callWS({ type: "proxlab/profile/list" })
      ]);
      if (t) {
        const a = t;
        typeof a.tts_voice == "string" && !a.tts_voices && (t.tts_voices = {
          normal: a.tts_voice,
          narration: "",
          speech: "",
          thoughts: ""
        }, delete t.tts_voice), t.tts_voices || (t.tts_voices = { normal: "", narration: "", speech: "", thoughts: "" }), t.use_profile === void 0 && (t.use_profile = !1), t.profile_id || (t.profile_id = ""), this._cardConfig = t;
      } else
        this._cardConfig = { ...rt, card_id: this._config.card_id };
      this._agents = e || [], this._voices = i || [], this._profiles = s || [], this._cardConfig.use_profile || this._loadAgentPrompt(this._cardConfig.agent_id);
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
    return r`
      <div class="editor">
        <div class="tabs">
          ${[
      { id: "general", label: "General" },
      { id: "voice", label: "Voice" },
      { id: "advanced", label: "Advanced" }
    ].map(
      (e) => r`
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
          ${this._tab === "general" ? this._renderGeneralTab() : c}
          ${this._tab === "voice" ? this._renderVoiceTab() : c}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : c}
        </div>
      </div>
    `;
  }
  // ---- Tabs ----
  _renderGeneralTab() {
    const t = this._cardConfig.use_profile;
    return r`
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
    return r`
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
      (e) => r`<option value=${e.profile_id} ?selected=${this._cardConfig.profile_id === e.profile_id}>
              ${e.name}${e.personality_enabled && e.personality?.name ? ` (${e.personality.name})` : ""}
            </option>`
    )}
        </select>
      </div>

      ${t ? r`
            <!-- Profile preview -->
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: var(--secondary-background-color, #f5f5f5); margin-top: 4px;">
              ${t.avatar ? r`<img src="${t.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />` : r`<div style="width: 48px; height: 48px; border-radius: 50%; background: var(--divider-color, #e5e7eb); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 18px;">${t.name.charAt(0).toUpperCase()}</div>`}
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 14px;">${t.name}</div>
                <div style="font-size: 12px; opacity: 0.6;">${t.connection_id ? `Connection: ${t.connection_id}` : `Agent: ${t.agent_id}`}</div>
                ${t.personality_enabled ? r`<div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">Character: ${t.personality?.name || "Unnamed"}</div>` : c}
              </div>
            </div>
            <div style="font-size: 11px; opacity: 0.5; margin-top: 8px; padding: 0 2px;">
              All agent settings are managed in the ProxLab panel under Agents → Profiles.
              Changes made there will be reflected on all cards using this profile.
            </div>
          ` : c}

      ${this._profiles.length === 0 ? r`
            <div style="text-align: center; padding: 16px; opacity: 0.5; font-size: 13px;">
              <p>No profiles found.</p>
              <p style="margin-top: 4px;">Create profiles in the ProxLab panel under Agents → Profiles.</p>
            </div>
          ` : c}

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
    return r`
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
      (t) => r`<option value=${t.agent_id} ?selected=${this._cardConfig.agent_id === t.agent_id}>
              ${t.name}
            </option>`
    )}
        </select>
      </div>
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar ? r`<img class="avatar-preview" src="${this._cardConfig.avatar}" />` : r`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
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
    const t = r`
      <div class="toggle-row">
        <div>
          <label>Auto TTS</label>
          <div class="sublabel">Automatically voice all agent responses</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.auto_tts ?? !1}
            @change=${(s) => this._updateField("auto_tts", s.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
    if (this._cardConfig.use_profile) {
      const s = this._profiles.find(
        (a) => a.profile_id === this._cardConfig.profile_id
      );
      if (s) {
        const a = s.tts_voices || { normal: "", narration: "", speech: "", thoughts: "" }, o = (d) => this._voices.find((l) => l.id === d)?.name ?? d ?? "None";
        return r`
          ${t}
          <div style="padding: 4px 0; opacity: 0.7; font-size: 13px; border-top: 1px solid var(--divider); margin-top: 8px; padding-top: 12px;">
            Voice selections are managed by the linked profile. Edit in Agents → Profiles.
          </div>
          <div class="field">
            <label>Normal: <strong>${o(a.normal)}</strong></label>
          </div>
          <div class="field">
            <label>Narration: <strong>${o(a.narration)}</strong></label>
          </div>
          <div class="field">
            <label>Speech: <strong>${o(a.speech)}</strong></label>
          </div>
          <div class="field">
            <label>Thoughts: <strong>${o(a.thoughts)}</strong></label>
          </div>
        `;
      }
      return r`
        ${t}
        <div style="opacity: 0.5; padding: 12px;">Select an agent profile first to see voice settings.</div>
      `;
    }
    const e = this._cardConfig.tts_voices ?? { normal: "", narration: "", speech: "", thoughts: "" }, i = (s, a, o) => r`
      <div class="field">
        <label>${s}</label>
        <div class="sublabel" style="font-size:11px;color:var(--card-secondary);margin-bottom:2px">${a}</div>
        <select
          .value=${e[o]}
          @change=${(d) => {
      const l = d.target.value;
      this._updateField("tts_voices", { ...e, [o]: l });
    }}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
      (d) => r`<option value=${d.id} ?selected=${e[o] === d.id}>
              ${d.name}
            </option>`
    )}
        </select>
      </div>
    `;
    return r`
      ${t}
      ${i("Normal Text", "Voice for unformatted text", "normal")}
      ${i("Narration", "Voice for *narration* text", "narration")}
      ${i("Speech", 'Voice for "speech" text', "speech")}
      ${i("Thoughts", "Voice for ```thoughts``` text", "thoughts")}
    `;
  }
  _renderAdvancedTab() {
    return r`
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
      <div class="toggle-row">
        <div>
          <label>Text Streaming</label>
          <div class="sublabel">Show text progressively as the LLM generates it</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.streaming_enabled ?? !1}
            @change=${(t) => this._updateField("streaming_enabled", t.target.checked)}
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
      const s = i.result.split(",")[1];
      try {
        const o = (await this.hass.callWS({
          type: "proxlab/card/avatar/upload",
          card_id: this._config.card_id,
          data: s,
          filename: e.name
        })).url.split("?")[0] + "?v=" + Date.now();
        this._updateField("avatar", o);
      } catch {
      }
    }, i.readAsDataURL(e);
  }
}
j.styles = _t;
j.properties = {
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
customElements.define("proxlab-chat-card-editor", j);
class Q extends v {
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
    return r`
      <div class="editor">
        <div class="tabs">
          ${[
      ["participants", "Participants"],
      ["settings", "Settings"]
    ].map(
      ([t, e]) => r`
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
          ${this._tab === "participants" ? this._renderParticipantsTab() : c}
          ${this._tab === "settings" ? this._renderSettingsTab() : c}
        </div>
      </div>
    `;
  }
  _renderParticipantsTab() {
    if (this._profiles.length === 0)
      return r`
        <div style="padding: 16px; text-align: center; opacity: 0.6;">
          <p>No agent profiles found.</p>
          <p style="font-size: 12px; margin-top: 8px;">
            Create profiles in the ProxLab panel under Agents → Profiles,
            or use "Save as Profile" in a chat card's Advanced tab.
          </p>
        </div>
      `;
    const t = new Set(this._cardConfig.profile_ids);
    return r`
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="sublabel" style="margin-bottom: 4px;">
          Select agent profiles to participate in this group chat.
          Order determines turn sequence for Round Robin mode.
        </div>
        ${this._profiles.map(
      (e) => r`
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
              ${e.avatar ? r`<img
                    src="${e.avatar}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                  />` : r`<div
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
    return r`
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

      <div class="toggle-row">
        <div>
          <label>Auto TTS</label>
          <div class="sublabel">Automatically voice all agent responses using profile TTS voices</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.auto_tts ?? !1}
            @change=${(t) => this._updateField(
      "auto_tts",
      t.target.checked
    )}
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div>
          <label>Text Streaming</label>
          <div class="sublabel">Show text progressively as agents generate responses</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.streaming_enabled ?? !1}
            @change=${(t) => this._updateField(
      "streaming_enabled",
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
    e ? i.includes(t) || i.push(t) : i = i.filter((s) => s !== t), this._updateField("profile_ids", i);
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
Q.styles = _t;
Q.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _profiles: { state: !0 },
  _loaded: { state: !0 },
  _tab: { state: !0 }
};
customElements.define(
  "proxlab-group-chat-card-editor",
  Q
);
const Dt = r`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, nt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`, ot = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`, Rt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`, Ft = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`, Nt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`, jt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`, lt = [250, 160, 30, 340, 200, 80, 290, 120];
class W extends v {
  constructor() {
    super(...arguments), this._profiles = [], this._messages = [], this._loading = !1, this._inputValue = "", this._configLoaded = !1, this._mentionOpen = !1, this._mentionFilter = "", this._editingIndex = -1, this._editValue = "", this._speakingIndex = -1, this._streaming = !1, this._audioQueue = [], this._audioPlaying = !1, this._onAudioQueueDone = null, this._ttsBuffer = "", this._streamingProfileId = "", this._ttsTextQueue = [], this._ttsProcessing = !1;
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
      t ? (this._cardConfig = t, this._profiles = t.profile_ids.map((i) => e.find((s) => s.profile_id === i)).filter((i) => !!i)) : (this._cardConfig = {
        card_id: this._config.card_id,
        profile_ids: [],
        turn_mode: "round_robin",
        card_height: 600,
        show_metadata: !1,
        allowed_users: [],
        streaming_enabled: !1,
        auto_tts: !1
      }, this._profiles = []);
    } catch {
    }
  }
  render() {
    if (!this._cardConfig)
      return r`<ha-card>
        <div style="padding: 24px; text-align: center;">
          <span style="opacity: 0.5;">Loading group chat...</span>
        </div>
      </ha-card>`;
    const t = this._cardConfig.card_height ?? 600;
    return r`
      <ha-card>
        <div class="card-container" style="height: ${t}px;">
          ${this._renderParticipantStrip()}
          <div class="messages" id="messages">
            ${this._messages.length === 0 ? r`<div class="empty-state">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  <span>Start a group conversation</span>
                </div>` : this._messages.map((e, i) => this._renderMessage(e, i))}
            ${this._loading ? r`<div class="loading-row">
                  <div class="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>` : c}
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
              ${Dt}
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }
  _renderParticipantStrip() {
    return this._profiles.length === 0 ? r`<div class="participant-strip">
        <span style="opacity: 0.5; font-size: 12px;">No participants — configure profiles in card editor</span>
      </div>` : r`
      <div class="participant-strip">
        ${this._profiles.map(
      (t) => r`
            <div class="participant">
              ${t.avatar ? r`<img class="participant-avatar" src="${t.avatar}" alt="${t.name}" />` : r`<div class="participant-avatar placeholder">${t.name.charAt(0).toUpperCase()}</div>`}
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
  _renderMessage(t, e) {
    if (t.role === "user")
      return r`
        <div class="msg msg-user ${this._editingIndex === e ? "editing" : ""}">
          ${this._editingIndex === e ? this._renderEditBubble(e) : r`
                <div class="bubble user-bubble">${this._formatContent(t.content)}</div>
                <div class="msg-actions">
                  ${this._loading ? c : r`
                        <button class="msg-btn" title="Edit" @click=${() => this._startEdit(e)}>
                          ${nt}
                        </button>
                        <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(e)}>
                          ${ot}
                        </button>
                      `}
                </div>
              `}
        </div>
      `;
    const i = this._profiles.findIndex(
      (d) => d.profile_id === t.profile_id
    ), s = lt[i >= 0 ? i % lt.length : 0], a = e === this._findLastAgentIndex(), o = this._streaming && this._streamingProfileId === t.profile_id && e === this._messages.length - 1;
    return r`
      <div class="agent-msg ${this._editingIndex === e ? "editing" : ""}">
        ${t.avatar ? r`<img class="msg-avatar" src="${t.avatar}" alt="${t.profile_name}" />` : r`<div class="msg-avatar placeholder">${(t.profile_name ?? "?").charAt(0).toUpperCase()}</div>`}
        <div class="agent-body">
          <span class="msg-name" style="color: hsl(${s}, 60%, 55%);">${t.profile_name}</span>
          ${this._editingIndex === e ? this._renderEditBubble(e) : r`
                <div class="bubble agent-bubble ${o ? "streaming-cursor" : ""}" style="border-left: 3px solid hsl(${s}, 60%, 55%);">
                  ${this._formatContent(t.content)}
                </div>
                <div class="msg-actions">
                  ${this._cardConfig?.show_metadata && t.metadata ? r`<span class="meta-inline">
                        ${t.metadata.model ?? ""}${t.metadata.tokens ? ` | ${t.metadata.tokens} tok` : ""}${t.metadata.duration_ms ? ` | ${(t.metadata.duration_ms / 1e3).toFixed(1)}s` : ""}
                      </span>` : c}
                  ${this._loading ? c : r`
                        <button class="msg-btn" title="Edit" @click=${() => this._startEdit(e)}>
                          ${nt}
                        </button>
                        <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(e)}>
                          ${ot}
                        </button>
                        <button
                          class="msg-btn speak ${this._speakingIndex === e ? "speaking" : ""}"
                          title="Speak"
                          @click=${() => this._speakGroupMessage(e)}
                        >
                          ${Rt}
                        </button>
                        ${a ? r`<button class="msg-btn" title="Regenerate" @click=${() => this._regenerate()}>
                              ${Ft}
                            </button>` : c}
                      `}
                </div>
              `}
        </div>
      </div>
    `;
  }
  _renderEditBubble(t) {
    return r`
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
            ${Nt}
          </button>
          <button class="msg-btn" title="Cancel" @click=${() => this._cancelEdit()}>
            ${jt}
          </button>
        </div>
      </div>
    `;
  }
  _findLastAgentIndex() {
    for (let t = this._messages.length - 1; t >= 0; t--)
      if (this._messages[t].role === "assistant") return t;
    return -1;
  }
  _formatContent(t) {
    return U(t).map((i) => i.type === "normal" ? r`<span>${i.text}</span>` : r`<span class="text-${i.type}">${i.text}</span>`);
  }
  // ---- Input & Mention ----
  _onInput(t) {
    const e = t.target;
    this._inputValue = e.value;
    const i = e.value.lastIndexOf("@");
    if (i >= 0 && this._cardConfig?.turn_mode === "at_mention") {
      const s = e.value.slice(i + 1);
      if (!s.includes(" ")) {
        this._mentionOpen = !0, this._mentionFilter = s.toLowerCase();
        return;
      }
    }
    this._mentionOpen = !1;
  }
  _renderMentionDropdown() {
    if (!this._mentionOpen || this._profiles.length === 0) return c;
    const t = this._profiles.filter(
      (e) => e.name.toLowerCase().includes(this._mentionFilter)
    );
    return t.length === 0 ? c : r`
      <div class="mention-dropdown">
        ${t.map(
      (e) => r`
            <div
              class="mention-item"
              @click=${() => this._completeMention(e.name)}
            >
              ${e.avatar ? r`<img src="${e.avatar}" class="mention-avatar" />` : r`<span class="mention-avatar placeholder">${e.name.charAt(0)}</span>`}
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
  // ---- Edit / Delete / Regenerate ----
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
  _deleteMessage(t) {
    const e = [...this._messages];
    e.splice(t, 1), this._messages = e;
  }
  async _regenerate() {
    if (this._loading || !this.hass || !this._config?.card_id) return;
    let t = -1;
    for (let i = this._messages.length - 1; i >= 0; i--)
      if (this._messages[i].role === "user") {
        t = i;
        break;
      }
    if (t < 0) return;
    this._messages = this._messages.slice(0, t + 1);
    const e = this._messages[t].content;
    await this._doSendMessage(e);
  }
  // ---- Send Message ----
  async _sendMessage() {
    const t = this._inputValue.trim();
    !t || !this._config?.card_id || this._loading || (this._messages = [
      ...this._messages,
      { role: "user", content: t, timestamp: Date.now() }
    ], this._inputValue = "", await this._doSendMessage(t));
  }
  async _doSendMessage(t) {
    !this._config?.card_id || this._loading || (this._cardConfig?.streaming_enabled ? await this._sendMessageStreaming(t) : await this._sendMessageSync(t));
  }
  async _sendMessageSync(t) {
    this._loading = !0, this._scrollToBottom();
    try {
      const e = await this.hass.callWS({
        type: "proxlab/group/invoke",
        card_id: this._config.card_id,
        message: t
      });
      if (e.responses) {
        const i = e.responses.map((s) => ({
          role: "assistant",
          content: s.response_text,
          timestamp: Date.now(),
          profile_id: s.profile_id,
          profile_name: s.profile_name,
          avatar: s.avatar,
          metadata: {
            tokens: s.tokens,
            duration_ms: s.duration_ms,
            model: s.model
          }
        }));
        if (this._messages = [...this._messages, ...i], this._cardConfig?.auto_tts)
          for (const s of e.responses) {
            if (!s.success) continue;
            const a = this._profiles.find(
              (o) => o.profile_id === s.profile_id
            );
            a?.tts_voices?.normal && this._speakSegmentsForProfile(s.response_text, a);
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
  async _sendMessageStreaming(t) {
    this._loading = !0, this._streaming = !0, this._ttsBuffer = "", this._scrollToBottom();
    try {
      const e = await this.hass.connection.subscribeMessage(
        (i) => {
          if (i.type === "profile_start")
            this._streamingProfileId = i.profile_id, this._messages = [
              ...this._messages,
              {
                role: "assistant",
                content: "",
                timestamp: Date.now(),
                profile_id: i.profile_id,
                profile_name: i.profile_name,
                avatar: i.avatar
              }
            ], this._ttsBuffer = "", this._scrollToBottom();
          else if (i.type === "delta") {
            const s = this._messages.length - 1;
            if (s >= 0) {
              const a = [...this._messages];
              a[s] = {
                ...a[s],
                content: (a[s].content || "") + i.text
              }, this._messages = a, this._scrollToBottom(), this._ttsBuffer += i.text, this._checkTtsChunk(i.profile_id);
            }
          } else if (i.type === "profile_done") {
            const s = this._messages.length - 1;
            if (s >= 0) {
              const a = [...this._messages];
              a[s] = {
                ...a[s],
                content: i.response_text || a[s].content,
                metadata: {
                  tokens: i.tokens,
                  duration_ms: i.duration_ms,
                  model: i.model
                }
              }, this._messages = a;
            }
            this._flushTtsBuffer(i.profile_id), this._streamingProfileId = "";
          } else i.type === "done" ? (this._streaming = !1, this._loading = !1, this._streamingProfileId = "", this._scrollToBottom(), e()) : i.type === "error" && (this._messages = [
            ...this._messages,
            {
              role: "assistant",
              content: `Error: ${i.error}`,
              timestamp: Date.now(),
              profile_name: "System"
            }
          ], this._streaming = !1, this._loading = !1, this._scrollToBottom(), e());
        },
        {
          type: "proxlab/group/invoke_stream",
          card_id: this._config.card_id,
          message: t
        }
      );
    } catch (e) {
      this._messages = [
        ...this._messages,
        {
          role: "assistant",
          content: `Error: ${e}`,
          timestamp: Date.now(),
          profile_name: "System"
        }
      ], this._streaming = !1, this._loading = !1, this._scrollToBottom();
    }
  }
  // ---- TTS ----
  async _speakGroupMessage(t) {
    const e = this._messages[t];
    if (!e || e.role !== "assistant") return;
    const i = this._profiles.find((s) => s.profile_id === e.profile_id);
    i && (this._speakingIndex = t, await this._speakSegmentsForProfile(e.content, i, () => {
      this._speakingIndex = -1;
    }));
  }
  async _speakSegmentsForProfile(t, e, i) {
    const s = e.tts_voices;
    if (!s) {
      i?.();
      return;
    }
    if (!(s.normal || s.narration || s.speech || s.thoughts) || !this.hass || !this._config?.card_id) {
      i?.();
      return;
    }
    const d = U(t).filter((l) => l.text.trim()).map((l) => ({ text: l.text, voice: s[l.type] || "" })).filter((l) => l.voice);
    if (d.length === 0) {
      i?.();
      return;
    }
    try {
      const l = await this.hass.callWS({
        type: "proxlab/card/tts/speak",
        card_id: this._config.card_id,
        segments: d
      });
      if (l?.audio_segments?.length) {
        for (const h of l.audio_segments) {
          const u = h.url || h.data_url;
          u && this._audioQueue.push(u);
        }
        this._onAudioQueueDone = i ?? null, this._playAudioQueue();
      } else
        i?.();
    } catch {
      i?.();
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
  // ---- TTS Chunking (Streaming) ----
  // Text chunks are queued and processed sequentially to avoid overwhelming
  // the TTS backend with concurrent requests (which causes dropped audio).
  _checkTtsChunk(t) {
    if (!this._cardConfig?.auto_tts) return;
    const e = this._profiles.find((s) => s.profile_id === t);
    if (!e) return;
    const i = this._findChunkBreak(this._ttsBuffer);
    if (i > 0) {
      const s = this._ttsBuffer.substring(0, i);
      this._ttsBuffer = this._ttsBuffer.substring(i), this._enqueueTtsChunk(s, e);
    }
  }
  _flushTtsBuffer(t) {
    if (!this._ttsBuffer.trim()) return;
    if (!this._cardConfig?.auto_tts) {
      this._ttsBuffer = "";
      return;
    }
    const e = this._profiles.find((i) => i.profile_id === t);
    e && this._enqueueTtsChunk(this._ttsBuffer, e), this._ttsBuffer = "";
  }
  _enqueueTtsChunk(t, e) {
    this._ttsTextQueue.push({ text: t, profile: e }), this._processTtsQueue();
  }
  async _processTtsQueue() {
    if (!this._ttsProcessing) {
      for (this._ttsProcessing = !0; this._ttsTextQueue.length > 0; ) {
        const { text: t, profile: e } = this._ttsTextQueue.shift();
        await this._speakSegmentsForProfile(t, e);
      }
      this._ttsProcessing = !1;
    }
  }
  _findChunkBreak(t) {
    const e = t.indexOf(`

`);
    if (e > 0) return e + 2;
    if (t.length < 200) return -1;
    const i = [". ", "! ", "? ", `.
`, `!
`, `?
`];
    for (let s = 200; s < t.length; s++)
      for (const a of i)
        if (t.substring(s, s + a.length) === a)
          return s + a.length;
    return -1;
  }
  // ---- Scroll ----
  _scrollToBottom() {
    requestAnimationFrame(() => {
      const t = this.shadowRoot?.getElementById("messages");
      t && (t.scrollTop = t.scrollHeight);
    });
  }
}
W.styles = Ot;
W.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _profiles: { state: !0 },
  _messages: { state: !0 },
  _loading: { state: !0 },
  _inputValue: { state: !0 },
  _configLoaded: { state: !0 },
  _mentionOpen: { state: !0 },
  _mentionFilter: { state: !0 },
  _editingIndex: { state: !0 },
  _editValue: { state: !0 },
  _speakingIndex: { state: !0 },
  _streaming: { state: !0 }
};
customElements.define("proxlab-group-chat-card", W);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-group-chat-card",
  name: "ProxLab Group Chat",
  description: "Multi-agent group chat card",
  preview: !1
});
const Qt = r`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, Wt = r`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`, qt = r`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`, Gt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`, Kt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`, Yt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`, Zt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`, Jt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`, Xt = r`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
class q extends v {
  constructor() {
    super(...arguments), this._messages = [], this._loading = !1, this._inputValue = "", this._recording = !1, this._configLoaded = !1, this._portraitWidth = 0, this._editingIndex = -1, this._editValue = "", this._speakingIndex = -1, this._streaming = !1, this._audioChunks = [], this._lastAvatarUrl = "", this._audioQueue = [], this._audioPlaying = !1, this._ttsBuffer = "", this._ttsTextQueue = [], this._ttsProcessing = !1, this._onAudioQueueDone = null;
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
            e && (t.avatar = e.avatar || t.avatar, t.personality_enabled = e.personality_enabled, t.personality = e.personality, t.prompt_override = e.prompt_override, t.agent_id = e.agent_id, t.tts_voices = e.tts_voices, t.portrait_width = e.portrait_width, !t.title_override && e.personality?.name ? t.title_override = e.personality.name : !t.title_override && e.name && (t.title_override = e.name));
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
      const s = e - 56 - 52 - 16 - 36, a = i.naturalWidth / i.naturalHeight, o = Math.round(s * a);
      this._portraitWidth = Math.max(80, Math.min(o, 600));
    }, i.src = t;
  }
  // ---- Rendering ----
  render() {
    if (!this._config)
      return r`<ha-card><div class="not-configured">No configuration</div></ha-card>`;
    if (this._cardConfig?.allowed_users?.length) {
      const d = this.hass?.user?.id;
      if (d && !this._cardConfig.allowed_users.includes(d))
        return r``;
    }
    const t = this._cardConfig?.card_height ?? 500, e = this._cardConfig?.hide_header ?? !1, i = this._cardConfig?.avatar, s = !!i, a = this._resolveTitle(), o = this._resolveStatus();
    return r`
      <ha-card>
        <div class="card-container" style="height: ${t}px">
          ${e ? c : this._renderHeader(a, o, i)}
          ${s ? r`
                <div class="card-layout">
                  ${this._renderPortraitPanel(i, a, o)}
                  <div class="chat-area">
                    ${this._renderMessages()}
                    ${this._renderInputBar()}
                  </div>
                </div>
              ` : r`
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
    return r`
      <div class="card-header">
        <div class="avatar">
          ${i ? r`<img src="${i}" alt="${t}" />` : t.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${t}</div>
          <div class="header-status">${e}</div>
        </div>
      </div>
    `;
  }
  _renderPortraitPanel(t, e, i) {
    const s = this._cardConfig?.portrait_width ?? "auto", a = typeof s == "number" && s > 0, o = a ? s : this._portraitWidth, d = o ? `width: ${o}px; max-width: 50%;` : "width: 25%; max-width: 50%;", l = a ? "portrait-img-cover" : "portrait-img-contain", h = this._resolveAgentLabel();
    return r`
      <div class="portrait-panel" style="${d}">
        <img class="${l}" src="${t}" alt="${e}" />
        <div class="portrait-name">${e}</div>
        <div class="portrait-status">${i}</div>
        ${h ? r`<div class="portrait-agent">${h}</div>` : c}
      </div>
    `;
  }
  _renderMessages() {
    if (this._messages.length === 0 && !this._loading)
      return r`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${qt}
            <span>Start a conversation</span>
          </div>
        </div>
      `;
    const t = this._findLastAssistantIndex();
    return r`
      <div class="messages">
        ${this._messages.map(
      (e, i) => {
        const s = this._streaming && e.role === "assistant" && i === this._messages.length - 1;
        return r`
            <div class="message ${e.role} ${this._editingIndex === i ? "editing" : ""}">
              ${this._editingIndex === i ? this._renderEditBubble(i) : r`
                    <div class="bubble ${s ? "streaming-cursor" : ""}">${this._formatContent(e.content)}</div>
                    <div class="msg-actions">
                      ${this._cardConfig?.show_metadata !== !1 && e.metadata ? r`<span class="meta-inline">
                            ${e.metadata.model ?? ""}${e.metadata.tokens ? ` | ${e.metadata.tokens} tok` : ""}${e.metadata.duration_ms ? ` | ${(e.metadata.duration_ms / 1e3).toFixed(1)}s` : ""}
                          </span>` : c}
                      ${this._loading ? c : r`
                            <button class="msg-btn" title="Edit" @click=${() => this._startEdit(i)}>
                              ${Gt}
                            </button>
                            <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(i)}>
                              ${Jt}
                            </button>
                            ${e.role === "assistant" ? r`<button
                                  class="msg-btn speak ${this._speakingIndex === i ? "speaking" : ""}"
                                  title="Speak"
                                  @click=${() => this._speakMessage(i)}
                                >
                                  ${Xt}
                                </button>` : c}
                            ${e.role === "assistant" && i === t ? r`<button class="msg-btn" title="Regenerate" @click=${() => this._regenerate()}>
                                  ${Kt}
                                </button>` : c}
                          `}
                    </div>
                  `}
            </div>
          `;
      }
    )}
        ${this._loading && !this._streaming ? r`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>` : c}
      </div>
    `;
  }
  _renderEditBubble(t) {
    return r`
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
            ${Yt}
          </button>
          <button class="msg-btn" title="Cancel" @click=${() => this._cancelEdit()}>
            ${Zt}
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
    return r`
      <div class="input-bar">
        <button
          class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
          @click=${this._toggleRecording}
          title="Voice input"
        >
          ${Wt}
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
          ${Qt}
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
    !e || !this.hass || !this._config?.card_id || (this._cardConfig?.streaming_enabled ? await this._doSendStreaming(e) : await this._doSendSync(e));
  }
  // ---- Actions ----
  async _sendMessage() {
    const t = this._inputValue.trim();
    !t || this._loading || !this.hass || !this._config?.card_id || (this._messages = [
      ...this._messages,
      { role: "user", content: t, timestamp: Date.now() }
    ], this._inputValue = "", this._cardConfig?.streaming_enabled ? await this._doSendStreaming(t) : await this._doSendSync(t));
  }
  async _doSendSync(t) {
    this._loading = !0, this._scrollToBottom();
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
  async _doSendStreaming(t) {
    this._loading = !0, this._streaming = !0, this._ttsBuffer = "", this._scrollToBottom();
    const e = this._messages.length;
    this._messages = [
      ...this._messages,
      { role: "assistant", content: "", timestamp: Date.now() }
    ];
    try {
      const i = await this.hass.connection.subscribeMessage(
        (s) => {
          if (s.type === "delta") {
            const a = [...this._messages];
            a[e] = {
              ...a[e],
              content: (a[e].content || "") + s.text
            }, this._messages = a, this._scrollToBottom(), this._ttsBuffer += s.text, this._checkTtsChunk();
          } else if (s.type === "done") {
            this._streaming = !1, this._loading = !1;
            const a = [...this._messages];
            a[e] = {
              ...a[e],
              content: s.response_text || a[e].content,
              metadata: {
                agent_name: s.agent_name,
                tokens: s.tokens,
                duration_ms: s.duration_ms,
                model: s.model
              }
            }, this._messages = a, this._flushTtsBuffer(), this._scrollToBottom(), i();
          } else if (s.type === "error") {
            this._streaming = !1, this._loading = !1;
            const a = [...this._messages];
            a[e] = {
              ...a[e],
              content: `Error: ${s.error}`
            }, this._messages = a, this._scrollToBottom(), i();
          }
        },
        {
          type: "proxlab/card/invoke_stream",
          card_id: this._config.card_id,
          message: t,
          conversation_id: `card_${this._config.card_id}`
        }
      );
    } catch (i) {
      const s = i instanceof Error ? i.message : String(i);
      this._streaming = !1, this._loading = !1;
      const a = [...this._messages];
      a[e] = {
        ...a[e],
        content: `Error: ${s}`
      }, this._messages = a, this._scrollToBottom();
    }
  }
  // ---- TTS Chunking (Streaming) ----
  // Text chunks are queued and processed sequentially to avoid overwhelming
  // the TTS backend with concurrent requests (which causes dropped audio).
  _checkTtsChunk() {
    if (!this._cardConfig?.auto_tts) return;
    const t = this._findChunkBreak(this._ttsBuffer);
    if (t > 0) {
      const e = this._ttsBuffer.substring(0, t);
      this._ttsBuffer = this._ttsBuffer.substring(t), this._enqueueTtsChunk(e);
    }
  }
  _flushTtsBuffer() {
    this._ttsBuffer.trim() && this._cardConfig?.auto_tts && this._enqueueTtsChunk(this._ttsBuffer), this._ttsBuffer = "";
  }
  _enqueueTtsChunk(t) {
    this._ttsTextQueue.push(t), this._processTtsQueue();
  }
  async _processTtsQueue() {
    if (!this._ttsProcessing) {
      for (this._ttsProcessing = !0; this._ttsTextQueue.length > 0; ) {
        const t = this._ttsTextQueue.shift();
        await this._speakSegments(t);
      }
      this._ttsProcessing = !1;
    }
  }
  _findChunkBreak(t) {
    const e = t.indexOf(`

`);
    if (e > 0) return e + 2;
    if (t.length < 200) return -1;
    const i = [". ", "! ", "? ", `.
`, `!
`, `?
`];
    for (let s = 200; s < t.length; s++)
      for (const a of i)
        if (t.substring(s, s + a.length) === a)
          return s + a.length;
    return -1;
  }
  _scrollToBottom() {
    requestAnimationFrame(() => {
      const t = this.renderRoot?.querySelector(".messages");
      t && (t.scrollTop = t.scrollHeight);
    });
  }
  _formatContent(t) {
    return U(t).map((i) => i.type === "normal" ? r`<span>${i.text}</span>` : r`<span class="text-${i.type}">${i.text}</span>`);
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
    const o = U(t).filter((d) => d.text.trim()).map((d) => ({ text: d.text, voice: i[d.type] || "" })).filter((d) => d.voice);
    if (o.length === 0) {
      e?.();
      return;
    }
    try {
      const d = await this.hass.callWS({
        type: "proxlab/card/tts/speak",
        card_id: this._config.card_id,
        segments: o
      });
      if (d?.audio_segments?.length) {
        for (const l of d.audio_segments) {
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
      const e = new FileReader(), i = await new Promise((a) => {
        e.onloadend = () => {
          const o = e.result;
          a(o.split(",")[1] || "");
        }, e.readAsDataURL(t);
      }), s = await this.hass.callWS({
        type: "proxlab/card/stt/transcribe",
        audio_data: i
      });
      s?.text && (this._inputValue = s.text);
    } catch {
    }
  }
}
q.styles = Ht;
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
  _speakingIndex: { state: !0 },
  _streaming: { state: !0 }
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
