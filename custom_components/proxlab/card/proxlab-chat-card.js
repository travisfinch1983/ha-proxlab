/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const I = globalThis, F = I.ShadowRoot && (I.ShadyCSS === void 0 || I.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, j = Symbol(), X = /* @__PURE__ */ new WeakMap();
let ct = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== j) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (F && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = X.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && X.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const vt = (s) => new ct(typeof s == "string" ? s : s + "", void 0, j), B = (s, ...t) => {
  const e = s.length === 1 ? s[0] : t.reduce((i, a, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(a) + s[r + 1], s[0]);
  return new ct(e, s, j);
}, mt = (s, t) => {
  if (F) s.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), a = I.litNonce;
    a !== void 0 && i.setAttribute("nonce", a), i.textContent = e.cssText, s.appendChild(i);
  }
}, Y = F ? (s) => s : (s) => s instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return vt(e);
})(s) : s;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: bt, defineProperty: xt, getOwnPropertyDescriptor: yt, getOwnPropertyNames: $t, getOwnPropertySymbols: wt, getPrototypeOf: Ct } = Object, v = globalThis, J = v.trustedTypes, At = J ? J.emptyScript : "", kt = v.reactiveElementPolyfillSupport, k = (s, t) => s, H = { toAttribute(s, t) {
  switch (t) {
    case Boolean:
      s = s ? At : null;
      break;
    case Object:
    case Array:
      s = s == null ? s : JSON.stringify(s);
  }
  return s;
}, fromAttribute(s, t) {
  let e = s;
  switch (t) {
    case Boolean:
      e = s !== null;
      break;
    case Number:
      e = s === null ? null : Number(s);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(s);
      } catch {
        e = null;
      }
  }
  return e;
} }, ht = (s, t) => !bt(s, t), Z = { attribute: !0, type: String, converter: H, reflect: !1, useDefault: !1, hasChanged: ht };
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
      a !== void 0 && xt(this.prototype, t, a);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: a, set: r } = yt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: a, set(o) {
      const c = a?.call(this);
      r?.call(this, o), this.requestUpdate(t, c, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Z;
  }
  static _$Ei() {
    if (this.hasOwnProperty(k("elementProperties"))) return;
    const t = Ct(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(k("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(k("properties"))) {
      const e = this.properties, i = [...$t(e), ...wt(e)];
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
      for (const a of i) e.unshift(Y(a));
    } else t !== void 0 && e.push(Y(t));
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
    const i = this.constructor.elementProperties.get(t), a = this.constructor._$Eu(t, i);
    if (a !== void 0 && i.reflect === !0) {
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : H).toAttribute(e, i.type);
      this._$Em = t, r == null ? this.removeAttribute(a) : this.setAttribute(a, r), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, a = i._$Eh.get(t);
    if (a !== void 0 && this._$Em !== a) {
      const r = i.getPropertyOptions(a), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : H;
      this._$Em = a;
      const c = o.fromAttribute(e, r.type);
      this[a] = c ?? this._$Ej?.get(a) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, a = !1, r) {
    if (t !== void 0) {
      const o = this.constructor;
      if (a === !1 && (r = this[t]), i ?? (i = o.getPropertyOptions(t)), !((i.hasChanged ?? ht)(r, e) || i.useDefault && i.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: a, wrapped: r }, o) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), r !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), a === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
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
        for (const [a, r] of this._$Ep) this[a] = r;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [a, r] of i) {
        const { wrapped: o } = r, c = this[a];
        o !== !0 || this._$AL.has(a) || c === void 0 || this.C(a, void 0, r, c);
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
$.elementStyles = [], $.shadowRootOptions = { mode: "open" }, $[k("elementProperties")] = /* @__PURE__ */ new Map(), $[k("finalized")] = /* @__PURE__ */ new Map(), kt?.({ ReactiveElement: $ }), (v.reactiveElementVersions ?? (v.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const S = globalThis, tt = (s) => s, L = S.trustedTypes, et = L ? L.createPolicy("lit-html", { createHTML: (s) => s }) : void 0, pt = "$lit$", f = `lit$${Math.random().toFixed(9).slice(2)}$`, ut = "?" + f, St = `<${ut}>`, y = document, P = () => y.createComment(""), M = (s) => s === null || typeof s != "object" && typeof s != "function", W = Array.isArray, Et = (s) => W(s) || typeof s?.[Symbol.iterator] == "function", D = `[ 	
\f\r]`, A = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, it = /-->/g, at = />/g, b = RegExp(`>|${D}(?:([^\\s"'>=/]+)(${D}*=${D}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), st = /'/g, rt = /"/g, gt = /^(?:script|style|textarea|title)$/i, Pt = (s) => (t, ...e) => ({ _$litType$: s, strings: t, values: e }), n = Pt(1), w = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), ot = /* @__PURE__ */ new WeakMap(), x = y.createTreeWalker(y, 129);
function _t(s, t) {
  if (!W(s) || !s.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return et !== void 0 ? et.createHTML(t) : t;
}
const Mt = (s, t) => {
  const e = s.length - 1, i = [];
  let a, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = A;
  for (let c = 0; c < e; c++) {
    const l = s[c];
    let h, u, p = -1, g = 0;
    for (; g < l.length && (o.lastIndex = g, u = o.exec(l), u !== null); ) g = o.lastIndex, o === A ? u[1] === "!--" ? o = it : u[1] !== void 0 ? o = at : u[2] !== void 0 ? (gt.test(u[2]) && (a = RegExp("</" + u[2], "g")), o = b) : u[3] !== void 0 && (o = b) : o === b ? u[0] === ">" ? (o = a ?? A, p = -1) : u[1] === void 0 ? p = -2 : (p = o.lastIndex - u[2].length, h = u[1], o = u[3] === void 0 ? b : u[3] === '"' ? rt : st) : o === rt || o === st ? o = b : o === it || o === at ? o = A : (o = b, a = void 0);
    const _ = o === b && s[c + 1].startsWith("/>") ? " " : "";
    r += o === A ? l + St : p >= 0 ? (i.push(h), l.slice(0, p) + pt + l.slice(p) + f + _) : l + f + (p === -2 ? c : _);
  }
  return [_t(s, r + (s[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class z {
  constructor({ strings: t, _$litType$: e }, i) {
    let a;
    this.parts = [];
    let r = 0, o = 0;
    const c = t.length - 1, l = this.parts, [h, u] = Mt(t, e);
    if (this.el = z.createElement(h, i), x.currentNode = this.el.content, e === 2 || e === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (a = x.nextNode()) !== null && l.length < c; ) {
      if (a.nodeType === 1) {
        if (a.hasAttributes()) for (const p of a.getAttributeNames()) if (p.endsWith(pt)) {
          const g = u[o++], _ = a.getAttribute(p).split(f), U = /([.?@])?(.*)/.exec(g);
          l.push({ type: 1, index: r, name: U[2], strings: _, ctor: U[1] === "." ? Tt : U[1] === "?" ? Ut : U[1] === "@" ? It : O }), a.removeAttribute(p);
        } else p.startsWith(f) && (l.push({ type: 6, index: r }), a.removeAttribute(p));
        if (gt.test(a.tagName)) {
          const p = a.textContent.split(f), g = p.length - 1;
          if (g > 0) {
            a.textContent = L ? L.emptyScript : "";
            for (let _ = 0; _ < g; _++) a.append(p[_], P()), x.nextNode(), l.push({ type: 2, index: ++r });
            a.append(p[g], P());
          }
        }
      } else if (a.nodeType === 8) if (a.data === ut) l.push({ type: 2, index: r });
      else {
        let p = -1;
        for (; (p = a.data.indexOf(f, p + 1)) !== -1; ) l.push({ type: 7, index: r }), p += f.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const i = y.createElement("template");
    return i.innerHTML = t, i;
  }
}
function C(s, t, e = s, i) {
  if (t === w) return t;
  let a = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const r = M(t) ? void 0 : t._$litDirective$;
  return a?.constructor !== r && (a?._$AO?.(!1), r === void 0 ? a = void 0 : (a = new r(s), a._$AT(s, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = a : e._$Cl = a), a !== void 0 && (t = C(s, a._$AS(s, t.values), a, i)), t;
}
class zt {
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
    let r = x.nextNode(), o = 0, c = 0, l = i[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let h;
        l.type === 2 ? h = new T(r, r.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(r, l.name, l.strings, this, t) : l.type === 6 && (h = new Lt(r, this, t)), this._$AV.push(h), l = i[++c];
      }
      o !== l?.index && (r = x.nextNode(), o++);
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
    t = C(this, t, e), M(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Et(t) ? this.k(t) : this._(t);
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
    const { values: e, _$litType$: i } = t, a = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = z.createElement(_t(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === a) this._$AH.p(e);
    else {
      const r = new zt(a, this), o = r.u(this.options);
      r.p(e), this.T(o), this._$AH = r;
    }
  }
  _$AC(t) {
    let e = ot.get(t.strings);
    return e === void 0 && ot.set(t.strings, e = new z(t)), e;
  }
  k(t) {
    W(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, a = 0;
    for (const r of t) a === e.length ? e.push(i = new T(this.O(P()), this.O(P()), this, this.options)) : i = e[a], i._$AI(r), a++;
    a < e.length && (this._$AR(i && i._$AB.nextSibling, a), e.length = a);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = tt(t).nextSibling;
      tt(t).remove(), t = i;
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
  constructor(t, e, i, a, r) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = e, this._$AM = a, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = d;
  }
  _$AI(t, e = this, i, a) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) t = C(this, t, e, 0), o = !M(t) || t !== this._$AH && t !== w, o && (this._$AH = t);
    else {
      const c = t;
      let l, h;
      for (t = r[0], l = 0; l < r.length - 1; l++) h = C(this, c[i + l], e, l), h === w && (h = this._$AH[l]), o || (o = !M(h) || h !== this._$AH[l]), h === d ? t = d : t !== d && (t += (h ?? "") + r[l + 1]), this._$AH[l] = h;
    }
    o && !a && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Tt extends O {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class Ut extends O {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class It extends O {
  constructor(t, e, i, a, r) {
    super(t, e, i, a, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = C(this, t, e, 0) ?? d) === w) return;
    const i = this._$AH, a = t === d && i !== d || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, r = t !== d && (i === d || a);
    a && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Lt {
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
const Ot = S.litHtmlPolyfillSupport;
Ot?.(z, T), (S.litHtmlVersions ?? (S.litHtmlVersions = [])).push("3.3.2");
const Dt = (s, t, e) => {
  const i = e?.renderBefore ?? t;
  let a = i._$litPart$;
  if (a === void 0) {
    const r = e?.renderBefore ?? null;
    i._$litPart$ = a = new T(t.insertBefore(P(), r), r, void 0, e ?? {});
  }
  return a._$AI(s), a;
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
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Dt(e, this.renderRoot, this.renderOptions);
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
const Rt = E.litElementPolyfillSupport;
Rt?.({ LitElement: m });
(E.litElementVersions ?? (E.litElementVersions = [])).push("4.2.2");
const Ht = B`
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
`, ft = B`
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
`, Vt = B`
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
function V(s) {
  const t = [];
  let e = 0, i = "";
  const a = () => {
    i && (t.push({ type: "normal", text: i }), i = "");
  };
  for (; e < s.length; ) {
    if (s[e] === "`" && s.slice(e, e + 3) === "```") {
      const r = s.indexOf("```", e + 3);
      if (r !== -1) {
        a(), t.push({ type: "thoughts", text: s.slice(e + 3, r) }), e = r + 3;
        continue;
      }
    }
    if (s[e] === "*") {
      const r = s.indexOf("*", e + 1);
      if (r !== -1) {
        a(), t.push({ type: "narration", text: s.slice(e + 1, r) }), e = r + 1;
        continue;
      }
    }
    if (s[e] === '"') {
      const r = s.indexOf('"', e + 1);
      if (r !== -1) {
        a(), t.push({ type: "speech", text: s.slice(e + 1, r) }), e = r + 1;
        continue;
      }
    }
    i += s[e], e++;
  }
  return a(), t;
}
const nt = {
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
  portrait_width: "auto"
};
async function Nt(s) {
  try {
    const t = await s.arrayBuffer(), e = new Uint8Array(t), i = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let r = 0; r < 8; r++)
      if (e[r] !== i[r]) return null;
    let a = 8;
    for (; a < e.length - 12; ) {
      const r = jt(e, a), o = N(e, a + 4, 4);
      if (o === "tEXt" || o === "iTXt") {
        const c = e.slice(a + 8, a + 8 + r), l = Ft(c, o);
        if (l) return l;
      }
      a += 12 + r;
    }
    return null;
  } catch {
    return null;
  }
}
function Ft(s, t) {
  if (t === "tEXt") {
    const e = s.indexOf(0);
    if (e < 0) return null;
    const i = N(s, 0, e).toLowerCase();
    if (i !== "ccv3" && i !== "chara") return null;
    const a = s.slice(e + 1), r = new TextDecoder().decode(a);
    return lt(r);
  }
  if (t === "iTXt") {
    const e = s.indexOf(0);
    if (e < 0) return null;
    const i = N(s, 0, e).toLowerCase();
    if (i !== "ccv3" && i !== "chara") return null;
    let a = e + 3;
    for (; a < s.length && s[a] !== 0; ) a++;
    for (a++; a < s.length && s[a] !== 0; ) a++;
    a++;
    const r = new TextDecoder().decode(s.slice(a));
    return lt(r);
  }
  return null;
}
function lt(s, t) {
  try {
    let e;
    try {
      const a = atob(s.trim()), r = Uint8Array.from(a, (o) => o.charCodeAt(0));
      e = new TextDecoder("utf-8").decode(r);
    } catch {
      e = s;
    }
    const i = JSON.parse(e);
    return i.spec === "chara_card_v3" && i.data || i.spec === "chara_card_v2" && i.data ? R(i.data) : i.name || i.description || i.personality ? R(i) : null;
  } catch {
    return null;
  }
}
function R(s) {
  return {
    name: String(s.name || ""),
    description: String(s.description || ""),
    personality: String(s.personality || ""),
    scenario: String(s.scenario || ""),
    first_mes: String(s.first_mes || ""),
    mes_example: String(s.mes_example || ""),
    system_prompt: String(s.system_prompt || ""),
    post_history_instructions: String(s.post_history_instructions || ""),
    alternate_greetings: Array.isArray(s.alternate_greetings) ? s.alternate_greetings.map(String) : [],
    tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
    creator_notes: String(s.creator_notes || "")
  };
}
function jt(s, t) {
  return (s[t] << 24 | s[t + 1] << 16 | s[t + 2] << 8 | s[t + 3]) >>> 0;
}
function N(s, t, e) {
  return String.fromCharCode(...s.slice(t, t + e));
}
class Q extends m {
  constructor() {
    super(...arguments), this._cardConfig = { ...nt }, this._tab = "general", this._agents = [], this._voices = [], this._loaded = !1, this._defaultPrompt = "", this._profileName = "", this._profileSaved = !1;
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
      if (t) {
        const a = t;
        typeof a.tts_voice == "string" && !a.tts_voices && (t.tts_voices = {
          normal: a.tts_voice,
          narration: "",
          speech: "",
          thoughts: ""
        }, delete t.tts_voice), t.tts_voices || (t.tts_voices = { normal: "", narration: "", speech: "", thoughts: "" }), this._cardConfig = t;
      } else
        this._cardConfig = { ...nt, card_id: this._config.card_id };
      this._agents = e || [], this._voices = i || [], this._loadAgentPrompt(this._cardConfig.agent_id);
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
    return n`
      <div class="editor">
        <div class="tabs">
          ${[
      { id: "general", label: "General", disabled: !1 },
      { id: "voice", label: "Voice", disabled: !1 },
      { id: "personality", label: "Personality", disabled: !t },
      { id: "prompt", label: "Prompt", disabled: !t },
      { id: "advanced", label: "Advanced", disabled: !1 }
    ].map(
      (i) => n`
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
          ${this._tab === "voice" ? this._renderVoiceTab() : d}
          ${this._tab === "personality" ? this._renderPersonalityTab() : d}
          ${this._tab === "prompt" ? this._renderPromptTab() : d}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : d}
        </div>
      </div>
    `;
  }
  // ---- Tabs ----
  _renderGeneralTab() {
    return n`
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
      (t) => n`<option value=${t.agent_id} ?selected=${this._cardConfig.agent_id === t.agent_id}>
              ${t.name}
            </option>`
    )}
        </select>
      </div>
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar ? n`<img class="avatar-preview" src="${this._cardConfig.avatar}" />` : n`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
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
  _renderVoiceTab() {
    const t = this._cardConfig.tts_voices ?? { normal: "", narration: "", speech: "", thoughts: "" }, e = (i, a, r) => n`
      <div class="field">
        <label>${i}</label>
        <div class="sublabel" style="font-size:11px;color:var(--card-secondary);margin-bottom:2px">${a}</div>
        <select
          .value=${t[r]}
          @change=${(o) => {
      const c = o.target.value;
      this._updateField("tts_voices", { ...t, [r]: c });
    }}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
      (o) => n`<option value=${o.id} ?selected=${t[r] === o.id}>
              ${o.name}
            </option>`
    )}
        </select>
      </div>
    `;
    return n`
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
  _renderPersonalityTab() {
    const t = this._cardConfig.personality;
    return n`
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

      ${this._cardConfig.personality_enabled ? n`
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
    return n`
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
      ${this._defaultPrompt ? n`
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
    return n`
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

      <div style="border-top: 1px solid var(--divider, #e5e7eb); margin-top: 12px; padding-top: 12px;">
        <label style="font-weight: 600; font-size: 13px;">Save as Profile</label>
        <div class="sublabel" style="margin-bottom: 8px;">Create a reusable agent profile from this card's config</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            type="text"
            placeholder="Profile name"
            .value=${this._profileName}
            @input=${(t) => {
      this._profileName = t.target.value, this._profileSaved = !1;
    }}
            style="flex: 1; padding: 6px 10px; border: 1px solid var(--divider, #ccc); border-radius: 6px; font-size: 13px;"
          />
          <button
            style="padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; background: var(--primary-color, #7c3aed); color: white;"
            @click=${this._saveAsProfile}
            ?disabled=${!this._profileName.trim()}
          >
            ${this._profileSaved ? "Saved!" : "Save"}
          </button>
        </div>
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
  async _saveAsProfile() {
    if (!this.hass || !this._profileName.trim()) return;
    const t = Math.random().toString(36).substring(2, 10), e = {
      name: this._profileName.trim(),
      agent_id: this._cardConfig.agent_id,
      avatar: this._cardConfig.avatar,
      prompt_override: this._cardConfig.prompt_override,
      personality_enabled: this._cardConfig.personality_enabled,
      personality: { ...this._cardConfig.personality },
      tts_voices: { ...this._cardConfig.tts_voices },
      auto_tts: this._cardConfig.auto_tts,
      portrait_width: this._cardConfig.portrait_width
    };
    try {
      await this.hass.callWS({
        type: "proxlab/profile/save",
        profile_id: t,
        profile: e
      }), this._profileSaved = !0, setTimeout(() => {
        this._profileSaved = !1;
      }, 2e3);
    } catch (i) {
      console.error("Failed to save profile:", i);
    }
  }
  async _onAvatarUpload(t) {
    const e = t.target.files?.[0];
    if (!e || !this.hass || !this._config?.card_id) return;
    const i = new FileReader();
    i.onloadend = async () => {
      const a = i.result.split(",")[1];
      try {
        const o = (await this.hass.callWS({
          type: "proxlab/card/avatar/upload",
          card_id: this._config.card_id,
          data: a,
          filename: e.name
        })).url.split("?")[0] + "?v=" + Date.now();
        this._updateField("avatar", o);
      } catch {
      }
    }, i.readAsDataURL(e);
  }
  async _onPngUpload(t) {
    const e = t.target.files?.[0];
    if (!e) return;
    const i = await Nt(e);
    if (i && (this._cardConfig = {
      ...this._cardConfig,
      personality: i,
      personality_enabled: !0
    }, this._saveAndFireEvent()), this.hass && this._config?.card_id) {
      const a = new FileReader();
      a.onloadend = async () => {
        const r = a.result.split(",")[1];
        try {
          const c = (await this.hass.callWS({
            type: "proxlab/card/avatar/upload",
            card_id: this._config.card_id,
            data: r,
            filename: e.name
          })).url.split("?")[0] + "?v=" + Date.now();
          this._updateField("avatar", c);
        } catch {
        }
      }, a.readAsDataURL(e);
    }
  }
}
Q.styles = ft;
Q.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _tab: { state: !0 },
  _agents: { state: !0 },
  _voices: { state: !0 },
  _loaded: { state: !0 },
  _defaultPrompt: { state: !0 },
  _profileName: { state: !0 },
  _profileSaved: { state: !0 }
};
customElements.define("proxlab-chat-card-editor", Q);
class q extends m {
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
    return n`
      <div class="editor">
        <div class="tabs">
          ${[
      ["participants", "Participants"],
      ["settings", "Settings"]
    ].map(
      ([t, e]) => n`
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
      return n`
        <div style="padding: 16px; text-align: center; opacity: 0.6;">
          <p>No agent profiles found.</p>
          <p style="font-size: 12px; margin-top: 8px;">
            Create profiles in the ProxLab panel under Agents → Profiles,
            or use "Save as Profile" in a chat card's Advanced tab.
          </p>
        </div>
      `;
    const t = new Set(this._cardConfig.profile_ids);
    return n`
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="sublabel" style="margin-bottom: 4px;">
          Select agent profiles to participate in this group chat.
          Order determines turn sequence for Round Robin mode.
        </div>
        ${this._profiles.map(
      (e) => n`
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
              ${e.avatar ? n`<img
                    src="${e.avatar}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                  />` : n`<div
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
    return n`
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
q.styles = ft;
q.properties = {
  hass: { attribute: !1 },
  _config: { state: !0 },
  _cardConfig: { state: !0 },
  _profiles: { state: !0 },
  _loaded: { state: !0 },
  _tab: { state: !0 }
};
customElements.define(
  "proxlab-group-chat-card-editor",
  q
);
const Bt = n`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, dt = [250, 160, 30, 340, 200, 80, 290, 120];
class G extends m {
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
      return n`<ha-card>
        <div style="padding: 24px; text-align: center;">
          <span style="opacity: 0.5;">Loading group chat...</span>
        </div>
      </ha-card>`;
    const t = this._cardConfig.card_height ?? 600;
    return n`
      <ha-card>
        <div class="card-container" style="height: ${t}px;">
          ${this._renderParticipantStrip()}
          <div class="messages" id="messages">
            ${this._messages.length === 0 ? n`<div class="empty-state">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  <span>Start a group conversation</span>
                </div>` : this._messages.map((e) => this._renderMessage(e))}
            ${this._loading ? n`<div class="loading-row">
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
              ${Bt}
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }
  _renderParticipantStrip() {
    return this._profiles.length === 0 ? n`<div class="participant-strip">
        <span style="opacity: 0.5; font-size: 12px;">No participants — configure profiles in card editor</span>
      </div>` : n`
      <div class="participant-strip">
        ${this._profiles.map(
      (t) => n`
            <div class="participant">
              ${t.avatar ? n`<img class="participant-avatar" src="${t.avatar}" alt="${t.name}" />` : n`<div class="participant-avatar placeholder">${t.name.charAt(0).toUpperCase()}</div>`}
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
      return n`
        <div class="msg msg-user">
          <div class="bubble user-bubble">${this._formatContent(t.content)}</div>
        </div>
      `;
    const e = this._profiles.findIndex(
      (a) => a.profile_id === t.profile_id
    ), i = dt[e >= 0 ? e % dt.length : 0];
    return n`
      <div class="msg agent-msg">
        ${t.avatar ? n`<img class="msg-avatar" src="${t.avatar}" alt="${t.profile_name}" />` : n`<div class="msg-avatar placeholder">${(t.profile_name ?? "?").charAt(0).toUpperCase()}</div>`}
        <div class="agent-body">
          <span class="msg-name" style="color: hsl(${i}, 60%, 55%);">${t.profile_name}</span>
          <div class="bubble agent-bubble" style="border-left: 3px solid hsl(${i}, 60%, 55%);">
            ${this._formatContent(t.content)}
          </div>
          ${this._cardConfig?.show_metadata && t.metadata ? n`<div class="msg-meta">
                ${t.metadata.model ? n`<span>${t.metadata.model}</span>` : d}
                ${t.metadata.tokens ? n`<span>${t.metadata.tokens} tok</span>` : d}
                ${t.metadata.duration_ms ? n`<span>${(t.metadata.duration_ms / 1e3).toFixed(1)}s</span>` : d}
              </div>` : d}
        </div>
      </div>
    `;
  }
  _formatContent(t) {
    return V(t).map((i) => i.type === "normal" ? n`<span>${i.text}</span>` : n`<span class="text-${i.type}">${i.text}</span>`);
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
    return t.length === 0 ? d : n`
      <div class="mention-dropdown">
        ${t.map(
      (e) => n`
            <div
              class="mention-item"
              @click=${() => this._completeMention(e.name)}
            >
              ${e.avatar ? n`<img src="${e.avatar}" class="mention-avatar" />` : n`<span class="mention-avatar placeholder">${e.name.charAt(0)}</span>`}
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
            const r = this._profiles.find(
              (o) => o.profile_id === a.profile_id
            );
            r?.auto_tts && r.tts_voices?.normal && this._speakForProfile(a.response_text, r);
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
G.styles = Vt;
G.properties = {
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
customElements.define("proxlab-group-chat-card", G);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-group-chat-card",
  name: "ProxLab Group Chat",
  description: "Multi-agent group chat card",
  preview: !1
});
const Wt = n`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`, Qt = n`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`, qt = n`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`, Gt = n`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`, Kt = n`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`, Xt = n`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`, Yt = n`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`, Jt = n`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`, Zt = n`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
class K extends m {
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
        this._cardConfig = t ?? void 0, t?.avatar && t.avatar !== this._lastAvatarUrl && (this._lastAvatarUrl = t.avatar, this._measureAvatar(t.avatar, t.card_height ?? 500)), this._messages.length === 0 && t?.personality_enabled && t?.personality?.first_mes && (this._messages = [
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
      const a = e - 56 - 52 - 16 - 36, r = i.naturalWidth / i.naturalHeight, o = Math.round(a * r);
      this._portraitWidth = Math.max(80, Math.min(o, 600));
    }, i.src = t;
  }
  // ---- Rendering ----
  render() {
    if (!this._config)
      return n`<ha-card><div class="not-configured">No configuration</div></ha-card>`;
    if (this._cardConfig?.allowed_users?.length) {
      const c = this.hass?.user?.id;
      if (c && !this._cardConfig.allowed_users.includes(c))
        return n``;
    }
    const t = this._cardConfig?.card_height ?? 500, e = this._cardConfig?.hide_header ?? !1, i = this._cardConfig?.avatar, a = !!i, r = this._resolveTitle(), o = this._resolveStatus();
    return n`
      <ha-card>
        <div class="card-container" style="height: ${t}px">
          ${e ? d : this._renderHeader(r, o, i)}
          ${a ? n`
                <div class="card-layout">
                  ${this._renderPortraitPanel(i, r, o)}
                  <div class="chat-area">
                    ${this._renderMessages()}
                    ${this._renderInputBar()}
                  </div>
                </div>
              ` : n`
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
    return n`
      <div class="card-header">
        <div class="avatar">
          ${i ? n`<img src="${i}" alt="${t}" />` : t.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${t}</div>
          <div class="header-status">${e}</div>
        </div>
      </div>
    `;
  }
  _renderPortraitPanel(t, e, i) {
    const a = this._cardConfig?.portrait_width ?? "auto", r = typeof a == "number" && a > 0, o = r ? a : this._portraitWidth, c = o ? `width: ${o}px; max-width: 50%;` : "width: 25%; max-width: 50%;", l = r ? "portrait-img-cover" : "portrait-img-contain", h = this._resolveAgentLabel();
    return n`
      <div class="portrait-panel" style="${c}">
        <img class="${l}" src="${t}" alt="${e}" />
        <div class="portrait-name">${e}</div>
        <div class="portrait-status">${i}</div>
        ${h ? n`<div class="portrait-agent">${h}</div>` : d}
      </div>
    `;
  }
  _renderMessages() {
    if (this._messages.length === 0 && !this._loading)
      return n`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${qt}
            <span>Start a conversation</span>
          </div>
        </div>
      `;
    const t = this._findLastAssistantIndex();
    return n`
      <div class="messages">
        ${this._messages.map(
      (e, i) => n`
            <div class="message ${e.role} ${this._editingIndex === i ? "editing" : ""}">
              ${this._editingIndex === i ? this._renderEditBubble(i) : n`
                    <div class="bubble">${this._formatContent(e.content)}</div>
                    <div class="msg-actions">
                      ${this._cardConfig?.show_metadata !== !1 && e.metadata ? n`<span class="meta-inline">
                            ${e.metadata.model ?? ""}${e.metadata.tokens ? ` | ${e.metadata.tokens} tok` : ""}${e.metadata.duration_ms ? ` | ${(e.metadata.duration_ms / 1e3).toFixed(1)}s` : ""}
                          </span>` : d}
                      ${this._loading ? d : n`
                            <button class="msg-btn" title="Edit" @click=${() => this._startEdit(i)}>
                              ${Gt}
                            </button>
                            <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(i)}>
                              ${Jt}
                            </button>
                            ${e.role === "assistant" ? n`<button
                                  class="msg-btn speak ${this._speakingIndex === i ? "speaking" : ""}"
                                  title="Speak"
                                  @click=${() => this._speakMessage(i)}
                                >
                                  ${Zt}
                                </button>` : d}
                            ${e.role === "assistant" && i === t ? n`<button class="msg-btn" title="Regenerate" @click=${() => this._regenerate()}>
                                  ${Kt}
                                </button>` : d}
                          `}
                    </div>
                  `}
            </div>
          `
    )}
        ${this._loading ? n`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>` : d}
      </div>
    `;
  }
  _renderEditBubble(t) {
    return n`
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
            ${Xt}
          </button>
          <button class="msg-btn" title="Cancel" @click=${() => this._cancelEdit()}>
            ${Yt}
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
    return n`
      <div class="input-bar">
        <button
          class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
          @click=${this._toggleRecording}
          title="Voice input"
        >
          ${Qt}
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
          ${Wt}
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
    return V(t).map((i) => i.type === "normal" ? n`<span>${i.text}</span>` : n`<span class="text-${i.type}">${i.text}</span>`);
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
    const o = V(t).filter((c) => c.text.trim()).map((c) => ({ text: c.text, voice: i[c.type] || "" })).filter((c) => c.voice);
    if (o.length === 0) {
      e?.();
      return;
    }
    try {
      const c = await this.hass.callWS({
        type: "proxlab/card/tts/speak",
        card_id: this._config.card_id,
        segments: o
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
      const e = new FileReader(), i = await new Promise((r) => {
        e.onloadend = () => {
          const o = e.result;
          r(o.split(",")[1] || "");
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
K.styles = Ht;
K.properties = {
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
customElements.define("proxlab-chat-card", K);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxlab-chat-card",
  name: "ProxLab Chat",
  description: "Chat with ProxLab agents directly from your dashboard",
  preview: !0,
  documentationURL: "https://github.com/travisfinch1983/ha-proxlab"
});
export {
  K as ProxLabChatCard
};
