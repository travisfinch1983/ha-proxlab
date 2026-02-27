/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const O = globalThis, F = O.ShadowRoot && (O.ShadyCSS === void 0 || O.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, j = Symbol(), q = /* @__PURE__ */ new WeakMap();
let rt = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== j) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (F && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = q.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && q.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const pt = (a) => new rt(typeof a == "string" ? a : a + "", void 0, j), ot = (a, ...t) => {
  const e = a.length === 1 ? a[0] : t.reduce((i, s, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + a[r + 1], a[0]);
  return new rt(e, a, j);
}, ut = (a, t) => {
  if (F) a.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = O.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, a.appendChild(i);
  }
}, G = F ? (a) => a : (a) => a instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return pt(e);
})(a) : a;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: _t, defineProperty: gt, getOwnPropertyDescriptor: ft, getOwnPropertyNames: vt, getOwnPropertySymbols: bt, getPrototypeOf: mt } = Object, v = globalThis, X = v.trustedTypes, yt = X ? X.emptyScript : "", $t = v.reactiveElementPolyfillSupport, S = (a, t) => a, L = { toAttribute(a, t) {
  switch (t) {
    case Boolean:
      a = a ? yt : null;
      break;
    case Object:
    case Array:
      a = a == null ? a : JSON.stringify(a);
  }
  return a;
}, fromAttribute(a, t) {
  let e = a;
  switch (t) {
    case Boolean:
      e = a !== null;
      break;
    case Number:
      e = a === null ? null : Number(a);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(a);
      } catch {
        e = null;
      }
  }
  return e;
} }, nt = (a, t) => !_t(a, t), J = { attribute: !0, type: String, converter: L, reflect: !1, useDefault: !1, hasChanged: nt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), v.litPropertyMetadata ?? (v.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let $ = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = J) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && gt(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: r } = ft(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: s, set(o) {
      const c = s?.call(this);
      r?.call(this, o), this.requestUpdate(t, c, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? J;
  }
  static _$Ei() {
    if (this.hasOwnProperty(S("elementProperties"))) return;
    const t = mt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(S("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(S("properties"))) {
      const e = this.properties, i = [...vt(e), ...bt(e)];
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
      for (const s of i) e.unshift(G(s));
    } else t !== void 0 && e.push(G(t));
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
    return ut(t, this.constructor.elementStyles), t;
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
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : L).toAttribute(e, i.type);
      this._$Em = t, r == null ? this.removeAttribute(s) : this.setAttribute(s, r), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const r = i.getPropertyOptions(s), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : L;
      this._$Em = s;
      const c = o.fromAttribute(e, r.type);
      this[s] = c ?? this._$Ej?.get(s) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, r) {
    if (t !== void 0) {
      const o = this.constructor;
      if (s === !1 && (r = this[t]), i ?? (i = o.getPropertyOptions(t)), !((i.hasChanged ?? nt)(r, e) || i.useDefault && i.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: r }, o) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), r !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
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
        for (const [s, r] of this._$Ep) this[s] = r;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, r] of i) {
        const { wrapped: o } = r, c = this[s];
        o !== !0 || this._$AL.has(s) || c === void 0 || this.C(s, void 0, r, c);
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
$.elementStyles = [], $.shadowRootOptions = { mode: "open" }, $[S("elementProperties")] = /* @__PURE__ */ new Map(), $[S("finalized")] = /* @__PURE__ */ new Map(), $t?.({ ReactiveElement: $ }), (v.reactiveElementVersions ?? (v.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const E = globalThis, K = (a) => a, R = E.trustedTypes, Z = R ? R.createPolicy("lit-html", { createHTML: (a) => a }) : void 0, lt = "$lit$", f = `lit$${Math.random().toFixed(9).slice(2)}$`, dt = "?" + f, xt = `<${dt}>`, y = document, k = () => y.createComment(""), T = (a) => a === null || typeof a != "object" && typeof a != "function", B = Array.isArray, wt = (a) => B(a) || typeof a?.[Symbol.iterator] == "function", D = `[ 	
\f\r]`, C = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Y = /-->/g, Q = />/g, b = RegExp(`>|${D}(?:([^\\s"'>=/]+)(${D}*=${D}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), tt = /'/g, et = /"/g, ct = /^(?:script|style|textarea|title)$/i, At = (a) => (t, ...e) => ({ _$litType$: a, strings: t, values: e }), l = At(1), w = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), it = /* @__PURE__ */ new WeakMap(), m = y.createTreeWalker(y, 129);
function ht(a, t) {
  if (!B(a) || !a.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Z !== void 0 ? Z.createHTML(t) : t;
}
const Ct = (a, t) => {
  const e = a.length - 1, i = [];
  let s, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = C;
  for (let c = 0; c < e; c++) {
    const n = a[c];
    let p, u, h = -1, _ = 0;
    for (; _ < n.length && (o.lastIndex = _, u = o.exec(n), u !== null); ) _ = o.lastIndex, o === C ? u[1] === "!--" ? o = Y : u[1] !== void 0 ? o = Q : u[2] !== void 0 ? (ct.test(u[2]) && (s = RegExp("</" + u[2], "g")), o = b) : u[3] !== void 0 && (o = b) : o === b ? u[0] === ">" ? (o = s ?? C, h = -1) : u[1] === void 0 ? h = -2 : (h = o.lastIndex - u[2].length, p = u[1], o = u[3] === void 0 ? b : u[3] === '"' ? et : tt) : o === et || o === tt ? o = b : o === Y || o === Q ? o = C : (o = b, s = void 0);
    const g = o === b && a[c + 1].startsWith("/>") ? " " : "";
    r += o === C ? n + xt : h >= 0 ? (i.push(p), n.slice(0, h) + lt + n.slice(h) + f + g) : n + f + (h === -2 ? c : g);
  }
  return [ht(a, r + (a[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class U {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let r = 0, o = 0;
    const c = t.length - 1, n = this.parts, [p, u] = Ct(t, e);
    if (this.el = U.createElement(p, i), m.currentNode = this.el.content, e === 2 || e === 3) {
      const h = this.el.content.firstChild;
      h.replaceWith(...h.childNodes);
    }
    for (; (s = m.nextNode()) !== null && n.length < c; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const h of s.getAttributeNames()) if (h.endsWith(lt)) {
          const _ = u[o++], g = s.getAttribute(h).split(f), H = /([.?@])?(.*)/.exec(_);
          n.push({ type: 1, index: r, name: H[2], strings: g, ctor: H[1] === "." ? Et : H[1] === "?" ? Pt : H[1] === "@" ? kt : z }), s.removeAttribute(h);
        } else h.startsWith(f) && (n.push({ type: 6, index: r }), s.removeAttribute(h));
        if (ct.test(s.tagName)) {
          const h = s.textContent.split(f), _ = h.length - 1;
          if (_ > 0) {
            s.textContent = R ? R.emptyScript : "";
            for (let g = 0; g < _; g++) s.append(h[g], k()), m.nextNode(), n.push({ type: 2, index: ++r });
            s.append(h[_], k());
          }
        }
      } else if (s.nodeType === 8) if (s.data === dt) n.push({ type: 2, index: r });
      else {
        let h = -1;
        for (; (h = s.data.indexOf(f, h + 1)) !== -1; ) n.push({ type: 7, index: r }), h += f.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const i = y.createElement("template");
    return i.innerHTML = t, i;
  }
}
function A(a, t, e = a, i) {
  if (t === w) return t;
  let s = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const r = T(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== r && (s?._$AO?.(!1), r === void 0 ? s = void 0 : (s = new r(a), s._$AT(a, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = s : e._$Cl = s), s !== void 0 && (t = A(a, s._$AS(a, t.values), s, i)), t;
}
class St {
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
    m.currentNode = s;
    let r = m.nextNode(), o = 0, c = 0, n = i[0];
    for (; n !== void 0; ) {
      if (o === n.index) {
        let p;
        n.type === 2 ? p = new M(r, r.nextSibling, this, t) : n.type === 1 ? p = new n.ctor(r, n.name, n.strings, this, t) : n.type === 6 && (p = new Tt(r, this, t)), this._$AV.push(p), n = i[++c];
      }
      o !== n?.index && (r = m.nextNode(), o++);
    }
    return m.currentNode = y, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class M {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, s) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
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
    t = A(this, t, e), T(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : wt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== d && T(this._$AH) ? this._$AA.nextSibling.data = t : this.T(y.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = U.createElement(ht(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const r = new St(s, this), o = r.u(this.options);
      r.p(e), this.T(o), this._$AH = r;
    }
  }
  _$AC(t) {
    let e = it.get(t.strings);
    return e === void 0 && it.set(t.strings, e = new U(t)), e;
  }
  k(t) {
    B(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const r of t) s === e.length ? e.push(i = new M(this.O(k()), this.O(k()), this, this.options)) : i = e[s], i._$AI(r), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = K(t).nextSibling;
      K(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class z {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, r) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = d;
  }
  _$AI(t, e = this, i, s) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) t = A(this, t, e, 0), o = !T(t) || t !== this._$AH && t !== w, o && (this._$AH = t);
    else {
      const c = t;
      let n, p;
      for (t = r[0], n = 0; n < r.length - 1; n++) p = A(this, c[i + n], e, n), p === w && (p = this._$AH[n]), o || (o = !T(p) || p !== this._$AH[n]), p === d ? t = d : t !== d && (t += (p ?? "") + r[n + 1]), this._$AH[n] = p;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Et extends z {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class Pt extends z {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class kt extends z {
  constructor(t, e, i, s, r) {
    super(t, e, i, s, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = A(this, t, e, 0) ?? d) === w) return;
    const i = this._$AH, s = t === d && i !== d || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, r = t !== d && (i === d || s);
    s && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
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
    A(this, t);
  }
}
const Ut = E.litHtmlPolyfillSupport;
Ut?.(U, M), (E.litHtmlVersions ?? (E.litHtmlVersions = [])).push("3.3.2");
const Mt = (a, t, e) => {
  const i = e?.renderBefore ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const r = e?.renderBefore ?? null;
    i._$litPart$ = s = new M(t.insertBefore(k(), r), r, void 0, e ?? {});
  }
  return s._$AI(a), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const P = globalThis;
class x extends $ {
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
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Mt(e, this.renderRoot, this.renderOptions);
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
x._$litElement$ = !0, x.finalized = !0, P.litElementHydrateSupport?.({ LitElement: x });
const Ht = P.litElementPolyfillSupport;
Ht?.({ LitElement: x });
(P.litElementVersions ?? (P.litElementVersions = [])).push("4.2.2");
const Ot = ot`
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
    max-width: 50%;
    display: flex;
    flex-direction: column;
    padding: 8px;
    border-right: 1px solid var(--divider);
    background: var(--card-bg);
    overflow: hidden;
  }

  .portrait-panel img {
    flex: 1;
    min-height: 0;
    width: auto;
    max-width: 100%;
    object-fit: cover;
    object-position: top;
    border-radius: 12px;
    border: 2px solid var(--divider);
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
`, Rt = ot`
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
`, st = {
  card_id: "",
  agent_id: "conversation_agent",
  prompt_override: "",
  avatar: "",
  tts_voice: "",
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
  hide_header: !1
};
async function zt(a) {
  try {
    const t = await a.arrayBuffer(), e = new Uint8Array(t), i = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let r = 0; r < 8; r++)
      if (e[r] !== i[r]) return null;
    let s = 8;
    for (; s < e.length - 12; ) {
      const r = Nt(e, s), o = I(e, s + 4, 4);
      if (o === "tEXt" || o === "iTXt") {
        const c = e.slice(s + 8, s + 8 + r), n = Dt(c, o);
        if (n) return n;
      }
      s += 12 + r;
    }
    return null;
  } catch {
    return null;
  }
}
function Dt(a, t) {
  if (t === "tEXt") {
    const e = a.indexOf(0);
    if (e < 0) return null;
    const i = I(a, 0, e).toLowerCase();
    if (i !== "ccv3" && i !== "chara") return null;
    const s = a.slice(e + 1), r = new TextDecoder().decode(s);
    return at(r);
  }
  if (t === "iTXt") {
    const e = a.indexOf(0);
    if (e < 0) return null;
    const i = I(a, 0, e).toLowerCase();
    if (i !== "ccv3" && i !== "chara") return null;
    let s = e + 3;
    for (; s < a.length && a[s] !== 0; ) s++;
    for (s++; s < a.length && a[s] !== 0; ) s++;
    s++;
    const r = new TextDecoder().decode(a.slice(s));
    return at(r);
  }
  return null;
}
function at(a, t) {
  try {
    let e;
    try {
      const s = atob(a.trim()), r = Uint8Array.from(s, (o) => o.charCodeAt(0));
      e = new TextDecoder("utf-8").decode(r);
    } catch {
      e = a;
    }
    const i = JSON.parse(e);
    return i.spec === "chara_card_v3" && i.data || i.spec === "chara_card_v2" && i.data ? N(i.data) : i.name || i.description || i.personality ? N(i) : null;
  } catch {
    return null;
  }
}
function N(a) {
  return {
    name: String(a.name || ""),
    description: String(a.description || ""),
    personality: String(a.personality || ""),
    scenario: String(a.scenario || ""),
    first_mes: String(a.first_mes || ""),
    mes_example: String(a.mes_example || ""),
    system_prompt: String(a.system_prompt || ""),
    post_history_instructions: String(a.post_history_instructions || ""),
    alternate_greetings: Array.isArray(a.alternate_greetings) ? a.alternate_greetings.map(String) : [],
    tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
    creator_notes: String(a.creator_notes || "")
  };
}
function Nt(a, t) {
  return (a[t] << 24 | a[t + 1] << 16 | a[t + 2] << 8 | a[t + 3]) >>> 0;
}
function I(a, t, e) {
  return String.fromCharCode(...a.slice(t, t + e));
}
class V extends x {
  constructor() {
    super(...arguments), this._cardConfig = { ...st }, this._tab = "general", this._agents = [], this._voices = [], this._loaded = !1, this._defaultPrompt = "";
  }
  setConfig(t) {
    this._config = t, this._loaded = !1;
  }
  async willUpdate() {
    this.hass && this._config?.card_id && !this._loaded && (this._loaded = !0, await this._loadData());
  }
  async _loadData() {
    try {
      const [t, e, i] = await Promise.all([
        this.hass.callWS({
          type: "proxlab/card/config/get",
          card_id: this._config.card_id
        }),
        this.hass.callWS({ type: "proxlab/agent/available" }),
        this.hass.callWS({ type: "proxlab/card/voices" })
      ]);
      t ? this._cardConfig = t : this._cardConfig = { ...st, card_id: this._config.card_id }, this._agents = e || [], this._voices = i || [], this._loadAgentPrompt(this._cardConfig.agent_id);
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
    const t = this._cardConfig.customize_enabled;
    return l`
      <div class="editor">
        <div class="tabs">
          ${[
      { id: "general", label: "General", disabled: !1 },
      { id: "personality", label: "Personality", disabled: !t },
      { id: "prompt", label: "Prompt", disabled: !t },
      { id: "advanced", label: "Advanced", disabled: !1 }
    ].map(
      (i) => l`
              <button
                class="tab ${this._tab === i.id ? "active" : ""} ${i.disabled ? "disabled" : ""}"
                @click=${() => {
        i.disabled || (this._tab = i.id);
      }}
              >
                ${i.label}
              </button>
            `
    )}
        </div>
        <div class="tab-content">
          ${this._tab === "general" ? this._renderGeneralTab() : d}
          ${this._tab === "personality" ? this._renderPersonalityTab() : d}
          ${this._tab === "prompt" ? this._renderPromptTab() : d}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : d}
        </div>
      </div>
    `;
  }
  // ---- Tabs ----
  _renderGeneralTab() {
    return l`
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
      (t) => l`<option value=${t.agent_id} ?selected=${this._cardConfig.agent_id === t.agent_id}>
              ${t.name}
            </option>`
    )}
        </select>
      </div>
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar ? l`<img class="avatar-preview" src="${this._cardConfig.avatar}" />` : l`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
          <input type="file" accept="image/*" @change=${this._onAvatarUpload} />
        </div>
      </div>
      <div class="field">
        <label>TTS Voice</label>
        <select
          .value=${this._cardConfig.tts_voice}
          @change=${(t) => this._updateField("tts_voice", t.target.value)}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
      (t) => l`<option value=${t.id} ?selected=${this._cardConfig.tts_voice === t.id}>
              ${t.name}
            </option>`
    )}
        </select>
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
      <div class="toggle-row">
        <div>
          <label>Customize</label>
          <div class="sublabel">Unlock Personality and Prompt tabs</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.customize_enabled}
            @change=${(t) => {
      this._updateField("customize_enabled", t.target.checked);
    }}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }
  _renderPersonalityTab() {
    const t = this._cardConfig.personality;
    return l`
      <div class="toggle-row">
        <div>
          <label>Enable Personality</label>
          <div class="sublabel">Use Character Card V3 personality fields</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.personality_enabled}
            @change=${(e) => this._updateField("personality_enabled", e.target.checked)}
          />
          <span class="slider"></span>
        </label>
      </div>

      ${this._cardConfig.personality_enabled ? l`
            <div class="field">
              <label>Import Character Card PNG</label>
              <input type="file" accept=".png" @change=${this._onPngUpload} />
            </div>
            <div class="field">
              <label>Character Name</label>
              <input
                type="text"
                .value=${t.name}
                @input=${(e) => this._updatePersonality("name", e.target.value)}
              />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea
                .value=${t.description}
                @input=${(e) => this._updatePersonality("description", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Personality</label>
              <textarea
                .value=${t.personality}
                @input=${(e) => this._updatePersonality("personality", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Scenario</label>
              <textarea
                .value=${t.scenario}
                @input=${(e) => this._updatePersonality("scenario", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>System Prompt</label>
              <textarea
                .value=${t.system_prompt}
                @input=${(e) => this._updatePersonality("system_prompt", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>First Message</label>
              <textarea
                .value=${t.first_mes}
                @input=${(e) => this._updatePersonality("first_mes", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Example Dialogue</label>
              <textarea
                .value=${t.mes_example}
                @input=${(e) => this._updatePersonality("mes_example", e.target.value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Post-History Instructions</label>
              <textarea
                .value=${t.post_history_instructions}
                @input=${(e) => this._updatePersonality("post_history_instructions", e.target.value)}
              ></textarea>
            </div>
          ` : d}
    `;
  }
  _renderPromptTab() {
    const t = this._cardConfig.prompt_override;
    return l`
      <div class="field">
        <label>System Prompt</label>
        <div class="sublabel" style="margin-bottom:4px;font-size:12px;color:var(--card-secondary)">
          Override the agent's default prompt. Leave empty to use the agent's built-in prompt.
        </div>
        <textarea
          style="min-height:200px"
          placeholder="${this._defaultPrompt || "Loading agent default prompt..."}"
          .value=${t}
          @input=${(e) => this._updateField("prompt_override", e.target.value)}
        ></textarea>
      </div>
      ${this._defaultPrompt ? l`
            <button
              class="tab"
              style="align-self:flex-start;padding:6px 12px;border:1px solid var(--divider);border-radius:6px;cursor:pointer"
              @click=${() => this._updateField("prompt_override", this._defaultPrompt)}
            >
              Copy Agent Default
            </button>
          ` : d}
    `;
  }
  _renderAdvancedTab() {
    return l`
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
  _updatePersonality(t, e) {
    this._cardConfig = {
      ...this._cardConfig,
      personality: { ...this._cardConfig.personality, [t]: e }
    }, this._saveAndFireEvent();
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
        const r = await this.hass.callWS({
          type: "proxlab/card/avatar/upload",
          card_id: this._config.card_id,
          data: s,
          filename: e.name
        });
        this._updateField("avatar", r.url);
      } catch {
      }
    }, i.readAsDataURL(e);
  }
  async _onPngUpload(t) {
    const e = t.target.files?.[0];
    if (!e) return;
    const i = await zt(e);
    if (i && (this._cardConfig = {
      ...this._cardConfig,
      personality: i,
      personality_enabled: !0
    }, this._saveAndFireEvent()), this.hass && this._config?.card_id) {
      const s = new FileReader();
      s.onloadend = async () => {
        const r = s.result.split(",")[1];
        try {
          const o = await this.hass.callWS({
            type: "proxlab/card/avatar/upload",
            card_id: this._config.card_id,
            data: r,
            filename: e.name
          });
          this._updateField("avatar", o.url);
        } catch {
        }
      }, s.readAsDataURL(e);
    }
  }
}
V.styles = Rt;
V.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _tab: { state: !0 },
  _agents: { state: !0 },
  _voices: { state: !0 },
  _loaded: { state: !0 },
  _defaultPrompt: { state: !0 }
};
customElements.define("proxlab-chat-card-editor", V);
const Lt = l`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, It = l`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`, Ft = l`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
class W extends x {
  constructor() {
    super(...arguments), this._messages = [], this._loading = !1, this._inputValue = "", this._recording = !1, this._configLoaded = !1, this._audioChunks = [];
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
        this._cardConfig = t ?? void 0, this._messages.length === 0 && t?.personality_enabled && t?.personality?.first_mes && (this._messages = [
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
  // ---- Rendering ----
  render() {
    if (!this._config)
      return l`<ha-card><div class="not-configured">No configuration</div></ha-card>`;
    if (this._cardConfig?.allowed_users?.length) {
      const c = this.hass?.user?.id;
      if (c && !this._cardConfig.allowed_users.includes(c))
        return l``;
    }
    const t = this._cardConfig?.card_height ?? 500, e = this._cardConfig?.hide_header ?? !1, i = this._cardConfig?.avatar, s = !!i, r = this._resolveTitle(), o = this._resolveStatus();
    return l`
      <ha-card>
        <div class="card-container" style="height: ${t}px">
          ${e ? d : this._renderHeader(r, o, i)}
          ${s ? l`
                <div class="card-layout">
                  ${this._renderPortraitPanel(i, r, o)}
                  <div class="chat-area">
                    ${this._renderMessages()}
                    ${this._renderInputBar()}
                  </div>
                </div>
              ` : l`
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
  _renderHeader(t, e, i) {
    return l`
      <div class="card-header">
        <div class="avatar">
          ${i ? l`<img src="${i}" alt="${t}" />` : t.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${t}</div>
          <div class="header-status">${e}</div>
        </div>
      </div>
    `;
  }
  _renderPortraitPanel(t, e, i) {
    return l`
      <div class="portrait-panel">
        <img src="${t}" alt="${e}" />
        <div class="portrait-name">${e}</div>
        <div class="portrait-status">${i}</div>
      </div>
    `;
  }
  _renderMessages() {
    return this._messages.length === 0 && !this._loading ? l`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${Ft}
            <span>Start a conversation</span>
          </div>
        </div>
      ` : l`
      <div class="messages">
        ${this._messages.map(
      (t) => l`
            <div class="message ${t.role}">
              <div class="bubble">${t.content}</div>
              ${this._cardConfig?.show_metadata !== !1 && t.metadata ? l`<div class="meta">
                    ${t.metadata.model ? t.metadata.model : ""}
                    ${t.metadata.tokens ? ` | ${t.metadata.tokens} tokens` : ""}
                    ${t.metadata.duration_ms ? ` | ${(t.metadata.duration_ms / 1e3).toFixed(1)}s` : ""}
                  </div>` : d}
            </div>
          `
    )}
        ${this._loading ? l`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>` : d}
      </div>
    `;
  }
  _renderInputBar() {
    return l`
      <div class="input-bar">
        <button
          class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
          @click=${this._toggleRecording}
          title="Voice input"
        >
          ${It}
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
          ${Lt}
        </button>
      </div>
    `;
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
        ], e.tts_audio_url && this._cardConfig?.tts_voice && this._playAudio(e.tts_audio_url);
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
  _playAudio(t) {
    try {
      new Audio(t).play().catch(() => {
      });
    } catch {
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
          const r = e.result;
          s(r.split(",")[1] || "");
        }, e.readAsDataURL(t);
      });
      if (this.hass.config.components.includes("stt")) {
        const s = await this.hass.callWS({
          type: "stt/stream",
          audio_data: i,
          language: this.hass.language || "en"
        });
        s?.text && (this._inputValue = s.text);
      }
    } catch {
    }
  }
}
W.styles = Ot;
W.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _messages: { state: !0 },
  _loading: { state: !0 },
  _inputValue: { state: !0 },
  _recording: { state: !0 },
  _configLoaded: { state: !0 }
};
customElements.define("proxlab-chat-card", W);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-chat-card",
  name: "ProxLab Chat",
  description: "Chat with ProxLab agents directly from your dashboard",
  preview: !0,
  documentationURL: "https://github.com/travisfinch1983/ha-proxlab"
});
export {
  W as ProxLabChatCard
};
