"use strict";
/* Price Tag — Val's resale helper. Compiled to app.js with tsc --jsx react. */
const { useState, useEffect, useRef } = React;
const FEE_RATE = 0.1325;
const FEE_FIXED = 0.4;
const STORE_KEY = "pricetag:items";
const CODE_KEY = "pricetag:code";
const MAX_SAVED = 40;
function money(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n)))
        return "—";
    return "$" + Math.round(Number(n));
}
function money2(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n)))
        return "—";
    return "$" + Number(n).toFixed(2);
}
function feeOn(sale) {
    const s = Number(sale) || 0;
    return s * FEE_RATE + FEE_FIXED;
}
function keepOn(sale, paid) {
    const s = Number(sale) || 0;
    return s - feeOn(s) - (Number(paid) || 0);
}
function loadItems() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch (e) {
        return [];
    }
}
function saveItems(list) {
    let trimmed = list.slice(0, MAX_SAVED);
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
            return trimmed;
        }
        catch (e) {
            // out of room — drop photos off the oldest records, then the records themselves
            const withPhotos = trimmed.filter(function (i) { return i.photos && i.photos.length; });
            if (withPhotos.length > 1) {
                const oldest = withPhotos[withPhotos.length - 1];
                oldest.photos = [];
            }
            else {
                trimmed = trimmed.slice(0, Math.max(1, trimmed.length - 3));
            }
        }
    }
    return trimmed;
}
function readFileAsImage(file) {
    return new Promise(function (resolve, reject) {
        const r = new FileReader();
        r.onload = function () {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error("That file isn't an image.")); };
            img.src = String(r.result);
        };
        r.onerror = function () { reject(new Error("Couldn't read that photo.")); };
        r.readAsDataURL(file);
    });
}
function drawTo(img, max, quality) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
}
async function prepPhoto(file) {
    const img = await readFileAsImage(file);
    const full = drawTo(img, 1100, 0.82);
    const thumb = drawTo(img, 560, 0.68);
    return { full: full, thumb: thumb, b64: full.split(",")[1] };
}
async function callPricer(payload, retry) {
    const headers = { "Content-Type": "application/json" };
    const code = localStorage.getItem(CODE_KEY);
    if (code)
        headers["x-app-code"] = code;
    let res;
    try {
        res = await fetch("/.netlify/functions/price", {
            method: "POST", headers: headers, body: JSON.stringify(payload)
        });
    }
    catch (e) {
        throw new Error("No connection. Check the signal and try again.");
    }
    if (res.status === 401) {
        if (retry)
            throw new Error("That passcode didn't work.");
        const entered = window.prompt("Passcode for Price Tag:");
        if (!entered)
            throw new Error("A passcode is needed to use this.");
        localStorage.setItem(CODE_KEY, entered.trim());
        return callPricer(payload, true);
    }
    if (res.status === 404) {
        throw new Error("The pricing service isn't running. The site needs to be deployed from GitHub, not dragged in.");
    }
    if (!res.ok) {
        throw new Error("The pricing service returned an error (" + res.status + "). Try again in a minute.");
    }
    const data = await res.json();
    if (data && data.error)
        throw new Error(data.error.message || "That request was turned down.");
    const text = (data.content || [])
        .map(function (b) { return b.type === "text" ? b.text : ""; })
        .filter(Boolean)
        .join("\n");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1)
        throw new Error("Nothing usable came back. Try again.");
    return JSON.parse(text.slice(start, end + 1));
}
/* ---------------- small pieces ---------------- */
function Seg(props) {
    return (React.createElement("div", { className: "seg", role: "tablist" }, props.options.map(function (o) {
        return (React.createElement("button", { key: o.id, role: "tab", "aria-selected": props.value === o.id, className: "seg-b" + (props.value === o.id ? " on" : ""), onClick: function () { props.onChange(o.id); } }, o.label));
    })));
}
function Steps(props) {
    const [open, setOpen] = useState(false);
    return (React.createElement("div", { className: "group" },
        React.createElement("button", { className: "row row-btn", onClick: function () { setOpen(!open); } },
            React.createElement("span", { className: "row-label" }, "How this works"),
            React.createElement("span", { className: "chev" + (open ? " down" : "") }, "\u203A")),
        open ? (React.createElement("div", { className: "steps" }, props.items.map(function (s, i) {
            return (React.createElement("div", { className: "step", key: i },
                React.createElement("span", { className: "step-n" }, i + 1),
                React.createElement("span", null,
                    React.createElement("span", { className: "step-t" }, s.t),
                    React.createElement("span", { className: "step-d" }, s.d))));
        }))) : null));
}
function CopyBtn(props) {
    const [done, setDone] = useState(false);
    return (React.createElement("button", { className: "copy" + (done ? " done" : ""), onClick: async function () {
            try {
                await navigator.clipboard.writeText(props.text);
                setDone(true);
                setTimeout(function () { setDone(false); }, 1600);
            }
            catch (e) {
                window.prompt("Copy this:", props.text);
            }
        } }, done ? "Copied" : props.label || "Copy"));
}
function Photos(props) {
    const mine = props.photos || [];
    const stock = (props.stock || []).filter(Boolean);
    const [bad, setBad] = useState({});
    const shots = mine.map(function (p) { return { src: p, mine: true }; })
        .concat(stock.filter(function (s) { return !bad[s.url]; }).map(function (s) { return { src: s.url, mine: false, label: s.label }; }));
    if (!shots.length)
        return null;
    return (React.createElement("div", { className: "shots" }, shots.map(function (s, i) {
        return (React.createElement("div", { className: "shot", key: i },
            React.createElement("img", { src: s.src, alt: s.mine ? "Your photo" : s.label || "Reference photo", onError: function () {
                    if (!s.mine)
                        setBad(function (b) { const n = Object.assign({}, b); n[s.src] = true; return n; });
                } }),
            !s.mine ? React.createElement("span", { className: "shot-tag" }, "Found online") : null));
    })));
}
/* ---------------- the listing view ---------------- */
function Listing(props) {
    const r = props.item;
    if (!r)
        return null;
    const paid = r.paid;
    const hasPaid = paid !== null && paid !== undefined && paid !== "";
    const mid = (Number(r.priceLow) + Number(r.priceHigh)) / 2;
    return (React.createElement("div", null,
        React.createElement("div", { className: "mock" },
            React.createElement(Photos, { photos: r.photos, stock: r.stockPhotos }),
            React.createElement("div", { className: "mock-body" },
                React.createElement("div", { className: "mock-eyebrow" }, "Your listing, roughly how it'll look"),
                React.createElement("div", { className: "mock-title" }, r.title),
                React.createElement("div", { className: "mock-price" },
                    money(r.priceLow),
                    " \u2013 ",
                    money(r.priceHigh),
                    React.createElement("span", { className: "mock-price-sub" }, "what these have been selling for")),
                r.description ? React.createElement("p", { className: "mock-desc" }, r.description) : null)),
        React.createElement("div", { className: "btnrow" },
            React.createElement(CopyBtn, { text: r.title, label: "Copy title" }),
            React.createElement(CopyBtn, { text: r.description, label: "Copy description" }),
            Array.isArray(r.keywords) && r.keywords.length ? (React.createElement(CopyBtn, { text: r.keywords.join(", "), label: "Copy keywords" })) : null),
        React.createElement("div", { className: "lbl" }, "What you'd make"),
        React.createElement("div", { className: "group" },
            React.createElement("div", { className: "row" },
                React.createElement("span", { className: "row-label" }, "Sells for (middle of range)"),
                React.createElement("span", { className: "row-val" }, money2(mid))),
            React.createElement("div", { className: "row" },
                React.createElement("span", { className: "row-label" }, "eBay's cut"),
                React.createElement("span", { className: "row-val neg" },
                    "\u2212",
                    money2(feeOn(mid)))),
            hasPaid ? React.createElement("div", { className: "row" },
                React.createElement("span", { className: "row-label" }, "What you paid"),
                React.createElement("span", { className: "row-val neg" },
                    "\u2212",
                    money2(paid))) : null,
            React.createElement("div", { className: "row strong" },
                React.createElement("span", { className: "row-label" }, "You keep"),
                React.createElement("span", { className: "row-val " + (keepOn(mid, hasPaid ? paid : 0) >= 0 ? "pos" : "neg") }, money2(keepOn(mid, hasPaid ? paid : 0)))),
            React.createElement("div", { className: "row sub" },
                React.createElement("span", { className: "row-label" }, "If it goes low / high"),
                React.createElement("span", { className: "row-val" },
                    money2(keepOn(r.priceLow, hasPaid ? paid : 0)),
                    " \u2013 ",
                    money2(keepOn(r.priceHigh, hasPaid ? paid : 0))))),
        React.createElement("p", { className: "foot" },
            "Shipping and packing still come out of that. ",
            hasPaid ? "" : "Add what you paid to see real profit."),
        r.priceBasis ? (React.createElement("div", null,
            React.createElement("div", { className: "lbl" }, "Why this price"),
            React.createElement("div", { className: "group" },
                React.createElement("div", { className: "pad" }, r.priceBasis)))) : null,
        Array.isArray(r.specifics) && r.specifics.length ? (React.createElement("div", null,
            React.createElement("div", { className: "lbl" }, "Item specifics"),
            React.createElement("div", { className: "group" }, r.specifics.map(function (s, i) {
                return React.createElement("div", { className: "row", key: i },
                    React.createElement("span", { className: "row-label" }, s.label),
                    React.createElement("span", { className: "row-val" }, s.value));
            })))) : null,
        Array.isArray(r.keywords) && r.keywords.length ? (React.createElement("div", null,
            React.createElement("div", { className: "lbl" }, "Words buyers search \u2014 work these into the title"),
            React.createElement("div", { className: "group" },
                React.createElement("div", { className: "pad chips" }, r.keywords.map(function (k, i) { return React.createElement("span", { className: "chip", key: i }, k); }))))) : null,
        r.bestPlace ? (React.createElement("div", null,
            React.createElement("div", { className: "lbl" }, "Where to sell it"),
            React.createElement("div", { className: "group" },
                React.createElement("div", { className: "row" },
                    React.createElement("span", { className: "row-label" }, "Best bet"),
                    React.createElement("span", { className: "row-val strong-v" }, r.bestPlace)),
                r.placeWhy ? React.createElement("div", { className: "pad sub-txt" }, r.placeWhy) : null,
                Array.isArray(r.alsoTry) && r.alsoTry.length ? (React.createElement("div", { className: "row" },
                    React.createElement("span", { className: "row-label" }, "Also worth a shot"),
                    React.createElement("span", { className: "row-val" }, r.alsoTry.join(", ")))) : null))) : null,
        Array.isArray(r.checkFirst) && r.checkFirst.length ? (React.createElement("div", null,
            React.createElement("div", { className: "lbl" }, "Check before you list"),
            React.createElement("div", { className: "group" }, r.checkFirst.map(function (c, i) {
                return React.createElement("div", { className: "row check", key: i },
                    React.createElement("span", { className: "row-label" }, c));
            })))) : null,
        Array.isArray(r.stockPhotos) && r.stockPhotos.length ? (React.createElement("p", { className: "foot" }, "Photos marked \u201Cfound online\u201D are for reference \u2014 shoot your own for the actual listing, since other people's photos can get a listing pulled.")) : null));
}
/* ---------------- screens ---------------- */
function PriceScreen(props) {
    const [photos, setPhotos] = useState([]);
    const [notes, setNotes] = useState("");
    const [paid, setPaid] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [result, setResult] = useState(null);
    const camRef = useRef(null);
    const libRef = useRef(null);
    async function addFiles(list) {
        setErr("");
        const files = Array.prototype.slice.call(list || []).slice(0, 3 - photos.length);
        for (const f of files) {
            try {
                const p = await prepPhoto(f);
                setPhotos(function (prev) { return prev.length >= 3 ? prev : prev.concat([p]); });
            }
            catch (e) {
                setErr(e.message);
            }
        }
    }
    async function go() {
        if (!photos.length && !notes.trim()) {
            setErr("Add a photo, or type what the item is.");
            return;
        }
        setBusy(true);
        setErr("");
        setResult(null);
        const content = photos.map(function (p) {
            return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.b64 } };
        });
        content.push({
            type: "text",
            text: "Today is " + new Date().toDateString() + ". Seller is in Rhode Island and sells mostly on eBay. " +
                "Items vary: toys, collectibles, housewares, tools, clothing, used restaurant and kitchen equipment.\n" +
                (notes.trim() ? "Seller's notes: " + notes.trim() + "\n" : "") +
                (paid ? "Seller paid $" + paid + " for it.\n" : "This may be an item she is thinking about bidding on, not one she owns yet.\n") +
                "Identify it, search for what comparable ones RECENTLY SOLD for, then reply with only the JSON object."
        });
        try {
            const parsed = await callPricer({
                system: SYSTEM_PRICE,
                messages: [{ role: "user", content: content }],
                tools: [{ type: "web_search_20250305", name: "web_search" }]
            });
            const record = Object.assign({}, parsed, {
                id: Date.now(),
                paid: paid ? Number(paid) : null,
                date: new Date().toLocaleDateString(),
                photos: photos.map(function (p) { return p.thumb; })
            });
            setResult(record);
            props.onSaved(record);
        }
        catch (e) {
            setErr(e.message || "Something went wrong. Try once more.");
        }
        finally {
            setBusy(false);
        }
    }
    function reset() { setPhotos([]); setNotes(""); setPaid(""); setResult(null); setErr(""); }
    if (busy)
        return React.createElement(Working, { label: "Checking what these sell for" });
    if (result) {
        return (React.createElement("div", null,
            React.createElement("div", { className: "hero" },
                React.createElement("div", { className: "hero-name" }, result.item),
                React.createElement("div", { className: "hero-sub" }, result.confidence === "low" ? "Not fully sure what this is — see below" : "Priced " + result.date)),
            React.createElement(Listing, { item: result }),
            React.createElement("button", { className: "cta", onClick: reset }, "Price another item"),
            React.createElement("div", { className: "spacer" })));
    }
    return (React.createElement("div", null,
        err ? React.createElement("div", { className: "err" }, err) : null,
        React.createElement(Steps, { items: [
                { t: "Photograph the item", d: "One of the whole thing, then close-ups of any label, stamp, model plate, or tag. That's usually what decides the price." },
                { t: "Type whatever you know", d: "Brand, size, where you got it, anything broken or missing. No item in hand? Just describe it, or paste the auction listing." },
                { t: "Enter what you paid", d: "Or what you'd bid. The profit gets worked out after eBay takes its cut." },
                { t: "Tap Price it", d: "About half a minute. You get a full mock-up listing, a price range, and what you'd clear." }
            ] }),
        React.createElement("div", { className: "lbl" }, "Photos"),
        React.createElement("div", { className: "group" },
            React.createElement("div", { className: "pad" },
                React.createElement("div", { className: "btnrow" },
                    React.createElement("button", { className: "btn", onClick: function () { camRef.current && camRef.current.click(); } }, "Take photo"),
                    React.createElement("button", { className: "btn", onClick: function () { libRef.current && libRef.current.click(); } }, "Choose photo")),
                React.createElement("input", { ref: camRef, type: "file", accept: "image/*", capture: "environment", className: "hide", onChange: function (e) { addFiles(e.target.files); } }),
                React.createElement("input", { ref: libRef, type: "file", accept: "image/*", multiple: true, className: "hide", onChange: function (e) { addFiles(e.target.files); } }),
                photos.length ? (React.createElement("div", { className: "thumbs" }, photos.map(function (p, i) {
                    return (React.createElement("div", { className: "thumb", key: i },
                        React.createElement("img", { src: p.thumb, alt: "Photo " + (i + 1) }),
                        React.createElement("button", { className: "x", "aria-label": "Remove photo", onClick: function () {
                                setPhotos(photos.filter(function (_, j) { return j !== i; }));
                            } }, "\u00D7")));
                }))) : React.createElement("p", { className: "hint" }, "Up to three. The label photo matters most."))),
        React.createElement("div", { className: "lbl" }, "Anything you already know"),
        React.createElement("div", { className: "group" },
            React.createElement("textarea", { className: "ta", rows: 3, placeholder: "Brand, size, condition, or paste the auction listing", value: notes, onChange: function (e) { setNotes(e.target.value); } })),
        React.createElement("div", { className: "lbl" }, "What you paid, or would bid"),
        React.createElement("div", { className: "group" },
            React.createElement("div", { className: "row" },
                React.createElement("span", { className: "row-label" }, "$"),
                React.createElement("input", { className: "num", type: "number", inputMode: "decimal", min: "0", step: "0.01", placeholder: "0.00", value: paid, onChange: function (e) { setPaid(e.target.value); } }))),
        React.createElement("button", { className: "cta", onClick: go }, "Price it"),
        React.createElement("div", { className: "spacer" })));
}
function MessageScreen(props) {
    const [itemId, setItemId] = useState("");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [out, setOut] = useState(null);
    async function go() {
        if (!text.trim()) {
            setErr("Paste the buyer's message first.");
            return;
        }
        setBusy(true);
        setErr("");
        setOut(null);
        const ctx = props.items.filter(function (i) { return String(i.id) === String(itemId); })[0];
        try {
            const parsed = await callPricer({
                system: SYSTEM_MSG,
                messages: [{
                        role: "user",
                        content: (ctx ? "Item: " + ctx.item + ". Comparable ones sold for " + money(ctx.priceLow) + "–" + money(ctx.priceHigh) + "." +
                            (ctx.paid ? " Seller paid " + money(ctx.paid) + " — never reveal this." : "") + "\n\n" : "") +
                            'Buyer\'s message:\n"""' + text.trim() + '"""'
                    }]
            });
            setOut(parsed);
        }
        catch (e) {
            setErr(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    if (busy)
        return React.createElement(Working, { label: "Reading the message" });
    return (React.createElement("div", null,
        err ? React.createElement("div", { className: "err" }, err) : null,
        React.createElement(Steps, { items: [
                { t: "Pick the item, if you priced it here", d: "Gives the reply your numbers to work with. Skip it otherwise." },
                { t: "Paste what the buyer wrote", d: "Straight out of eBay messages or offers." },
                { t: "Tap Read it", d: "You get a straight read on the person, any red flags, and a reply you can send as-is." }
            ] }),
        React.createElement("div", { className: "lbl" }, "Which item"),
        React.createElement("div", { className: "group" },
            React.createElement("select", { className: "sel", value: itemId, onChange: function (e) { setItemId(e.target.value); } },
                React.createElement("option", { value: "" }, "Not one of my saved items"),
                props.items.map(function (i) { return React.createElement("option", { key: i.id, value: i.id }, i.item); }))),
        React.createElement("div", { className: "lbl" }, "What the buyer said"),
        React.createElement("div", { className: "group" },
            React.createElement("textarea", { className: "ta", rows: 5, placeholder: "Paste their message or offer", value: text, onChange: function (e) { setText(e.target.value); } })),
        React.createElement("button", { className: "cta", onClick: go }, "Read it"),
        out ? (React.createElement("div", null,
            React.createElement("div", { className: "verdict lv-" + (out.level || "ok") },
                React.createElement("div", { className: "verdict-name" }, out.read),
                React.createElement("p", { className: "verdict-why" }, out.why)),
            Array.isArray(out.redFlags) && out.redFlags.length ? (React.createElement("div", null,
                React.createElement("div", { className: "lbl" }, "Red flags"),
                React.createElement("div", { className: "group" }, out.redFlags.map(function (f, i) { return React.createElement("div", { className: "row flag", key: i },
                    React.createElement("span", { className: "row-label" }, f)); })))) : null,
            Array.isArray(out.replies) && out.replies.map(function (rep, i) {
                return (React.createElement("div", { key: i },
                    React.createElement("div", { className: "lbl" }, rep.label),
                    React.createElement("div", { className: "group" },
                        React.createElement("div", { className: "pad reply" }, rep.text)),
                    React.createElement("div", { className: "btnrow" },
                        React.createElement(CopyBtn, { text: rep.text, label: "Copy reply" }))));
            }))) : null,
        React.createElement("div", { className: "spacer" })));
}
function SavedScreen(props) {
    const [openId, setOpenId] = useState(null);
    const open = props.items.filter(function (i) { return i.id === openId; })[0];
    if (open) {
        return (React.createElement("div", null,
            React.createElement("button", { className: "back", onClick: function () { setOpenId(null); } }, "\u2039 All items"),
            React.createElement("div", { className: "hero" },
                React.createElement("div", { className: "hero-name" }, open.item),
                React.createElement("div", { className: "hero-sub" },
                    "Saved ",
                    open.date,
                    open.paid ? " · paid " + money(open.paid) : "")),
            React.createElement(Listing, { item: open }),
            React.createElement("button", { className: "cta danger", onClick: function () {
                    if (window.confirm("Delete " + open.item + "?")) {
                        props.onDelete(open.id);
                        setOpenId(null);
                    }
                } }, "Delete this item"),
            React.createElement("div", { className: "spacer" })));
    }
    if (!props.items.length) {
        return (React.createElement("div", null,
            React.createElement("div", { className: "empty" },
                React.createElement("div", { className: "empty-t" }, "Nothing saved yet"),
                React.createElement("div", { className: "empty-d" }, "Every item you price is kept here with its full listing, photos, and what you'd make."))));
    }
    return (React.createElement("div", null,
        React.createElement("div", { className: "lbl" },
            props.items.length,
            " item",
            props.items.length === 1 ? "" : "s"),
        React.createElement("div", { className: "group" }, props.items.map(function (i) {
            const keep = keepOn((Number(i.priceLow) + Number(i.priceHigh)) / 2, i.paid || 0);
            return (React.createElement("button", { className: "row row-btn item-row", key: i.id, onClick: function () { setOpenId(i.id); window.scrollTo(0, 0); } },
                i.photos && i.photos.length ? React.createElement("img", { className: "row-thumb", src: i.photos[0], alt: "" }) : React.createElement("span", { className: "row-thumb ph" }),
                React.createElement("span", { className: "item-main" },
                    React.createElement("span", { className: "item-name" }, i.item),
                    React.createElement("span", { className: "item-sub" },
                        money(i.priceLow),
                        "\u2013",
                        money(i.priceHigh),
                        i.paid ? " · paid " + money(i.paid) : "")),
                React.createElement("span", { className: "item-keep " + (keep >= 0 ? "pos" : "neg") }, money(keep)),
                React.createElement("span", { className: "chev" }, "\u203A")));
        })),
        React.createElement("p", { className: "foot" }, "The green number is roughly what you'd keep after fees."),
        React.createElement("div", { className: "spacer" })));
}
function Working(props) {
    return (React.createElement("div", { className: "working" },
        React.createElement("div", { className: "spin" }),
        React.createElement("div", { className: "working-t" }, props.label),
        React.createElement("div", { className: "working-d" }, "Searching sold listings. Takes about half a minute.")));
}
/* ---------------- prompts ---------------- */
const SYSTEM_PRICE = "You price secondhand goods for a small eBay seller and write her listings. Items range from toys and collectibles to tools, housewares, clothing, and used commercial kitchen equipment. " +
    "Identify the item from the photos and notes, then use web search to find what comparable ones have RECENTLY SOLD for — sold and completed prices, never asking prices. " +
    "Also search for the manufacturer's or a retailer's product image of the exact item when you can find one, and for the words buyers actually type when searching for it. " +
    "For commercial restaurant equipment, weigh that local pickup often beats shipping, and note whether a model is worth more working than parted out. " +
    "Write the title to be FOUND: real search terms first, brand and model and size, no filler words, no ALL CAPS, no asterisks. " +
    "Reply with ONLY a raw JSON object. No markdown, no fences, no text around it. Schema: " +
    '{"item":string (short plain name),' +
    '"confidence":"high"|"medium"|"low",' +
    '"title":string (listing title, MAX 80 characters),' +
    '"description":string (listing body, 80-120 words, plain honest sentences, condition based only on what the photos and notes show, never invent flaws or history),' +
    '"specifics":[{"label":string,"value":string}] (4-7 entries such as Brand, Model, Condition, Category, Size, Material, Era; use "Unknown" when unsure),' +
    '"priceLow":number,"priceHigh":number (realistic sold range in USD),' +
    '"priceBasis":string (two or three sentences on what the comps showed, including roughly how many sold and how recently),' +
    '"stockPhotos":[{"url":string,"label":string}] (0-3 DIRECT image URLs ending in .jpg/.jpeg/.png/.webp showing this exact item, from manufacturer or retailer pages found in search; omit entirely rather than guessing a URL),' +
    '"bestPlace":string,"placeWhy":string (one sentence),' +
    '"alsoTry":[string] (0-2 others),' +
    '"keywords":[string] (6-10 terms buyers actually search for this),' +
    '"checkFirst":[string] (2-4 short things to verify before listing: authenticity marks, missing parts, whether it powers on, shipping weight or freight, category quirks)}. ' +
    "If you cannot identify it confidently, set confidence low and say in priceBasis exactly what photo or detail would settle it. Never invent a brand, model, or URL you cannot see.";
const SYSTEM_MSG = "You screen buyer messages for a small eBay seller and draft her replies. " +
    "Sort the message into one of: Real buyer, Lowball, Just looking, or Likely scam. " +
    "Scam and hassle signals: pushing to move off-platform, asking for an email address or phone number, offering to overpay, gift cards or PayPal friends-and-family, odd urgency, a shipping agent or third party, shipping before payment clears, or a brand-new account making a large offer. " +
    "Draft replies that are short, plain, and polite — no exclamation marks, no salesmanship, no apologising. Never reveal what the seller paid or her lowest acceptable price. " +
    "For a lowball within roughly 20 percent of the price, offer a counter. Below that, decline warmly and leave the door open. For a likely scam, give one flat line or none at all and tell her to report and block. " +
    "Reply with ONLY a raw JSON object, no markdown. Schema: " +
    '{"read":"Real buyer"|"Lowball"|"Just looking"|"Likely scam",' +
    '"level":"ok"|"warn"|"bad",' +
    '"why":string (two sentences on what this person is doing and what to do about it),' +
    '"redFlags":[string] (0-4 short specifics, empty if none),' +
    '"replies":[{"label":string (2-4 words),"text":string}] (1-2 options)}';
/* ---------------- app ---------------- */
function App() {
    const [tab, setTab] = useState("price");
    const [items, setItems] = useState([]);
    useEffect(function () { setItems(loadItems()); }, []);
    function onSaved(record) {
        const next = saveItems([record].concat(items));
        setItems(next);
    }
    function onDelete(id) {
        const next = saveItems(items.filter(function (i) { return i.id !== id; }));
        setItems(next);
    }
    return (React.createElement("div", { className: "app" },
        React.createElement("header", { className: "nav" },
            React.createElement("h1", { className: "title" }, "Price Tag"),
            React.createElement("p", { className: "tagline" }, "Photo in, listing out")),
        React.createElement("div", { className: "segwrap" },
            React.createElement(Seg, { value: tab, onChange: setTab, options: [
                    { id: "price", label: "Price it" },
                    { id: "msg", label: "Messages" },
                    { id: "saved", label: "Saved" }
                ] })),
        React.createElement("main", null,
            tab === "price" ? React.createElement(PriceScreen, { onSaved: onSaved }) : null,
            tab === "msg" ? React.createElement(MessageScreen, { items: items }) : null,
            tab === "saved" ? React.createElement(SavedScreen, { items: items, onDelete: onDelete }) : null)));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
