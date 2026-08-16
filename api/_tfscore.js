var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var WI_FIELDS = 'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State';
var WANTED = [
    'Microsoft.RequirementCategory',
    'Microsoft.FeatureCategory',
    'Microsoft.BugCategory',
];
function basic(pat) {
    return "Basic ".concat(Buffer.from(":".concat(pat)).toString('base64'));
}
function base(org) {
    return "https://dev.azure.com/".concat(encodeURIComponent(org), "/_apis/");
}
function resolveTypes(org, pat) {
    return __awaiter(this, void 0, void 0, function () {
        var r, data, out, _i, _a, c, name_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, fetch("".concat(base(org), "wit/workitemtypecategories?api-version=7.0"), {
                        headers: { Authorization: basic(pat) },
                    })];
                case 1:
                    r = _d.sent();
                    if (!r.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, r.json()];
                case 2:
                    data = (_d.sent());
                    out = [];
                    for (_i = 0, _a = (_b = data.value) !== null && _b !== void 0 ? _b : []; _i < _a.length; _i++) {
                        c = _a[_i];
                        name_1 = (_c = c.defaultWorkItemType) === null || _c === void 0 ? void 0 : _c.name;
                        if (name_1 && WANTED.includes(c.referenceName))
                            out.push(name_1);
                    }
                    return [2 /*return*/, out];
            }
        });
    });
}
function assignedIds(org, pat, types) {
    return __awaiter(this, void 0, void 0, function () {
        var inList, query, r, data;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    inList = types.map(function (t) { return "'".concat(t.replace(/'/g, "''"), "'"); }).join(',');
                    query = "SELECT [System.Id] FROM WorkItems " +
                        "WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] IN (".concat(inList, ")");
                    return [4 /*yield*/, fetch("".concat(base(org), "wit/wiql?api-version=7.0"), {
                            method: 'POST',
                            headers: { Authorization: basic(pat), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ query: query }),
                        })];
                case 1:
                    r = _b.sent();
                    if (!r.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, r.json()];
                case 2:
                    data = (_b.sent());
                    return [2 /*return*/, ((_a = data.workItems) !== null && _a !== void 0 ? _a : []).map(function (w) { return w.id; })];
            }
        });
    });
}
function fetchDetails(org, pat, ids) {
    return __awaiter(this, void 0, void 0, function () {
        var list, r, data;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!ids.length)
                        return [2 /*return*/, []];
                    list = ids.slice(0, 200).join(',');
                    return [4 /*yield*/, fetch("".concat(base(org), "wit/workitems?ids=").concat(list, "&fields=").concat(WI_FIELDS, "&api-version=7.0"), { headers: { Authorization: basic(pat) } })];
                case 1:
                    r = _b.sent();
                    if (!r.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, r.json()];
                case 2:
                    data = (_b.sent());
                    return [2 /*return*/, (_a = data.value) !== null && _a !== void 0 ? _a : []];
            }
        });
    });
}
function normalizePath(p) {
    if (!p)
        return '';
    return p.replace(/^\\/, '').replace(/\\Iteration(?=\\|$)/, '');
}
function flatten(node, map, counter) {
    var _a, _b;
    var norm = normalizePath(node.path);
    if (norm)
        map.set(norm, { order: counter.n++, startDate: (_a = node.attributes) === null || _a === void 0 ? void 0 : _a.startDate });
    for (var _i = 0, _c = (_b = node.children) !== null && _b !== void 0 ? _b : []; _i < _c.length; _i++) {
        var c = _c[_i];
        flatten(c, map, counter);
    }
}
function iterationOrder(org, pat) {
    return __awaiter(this, void 0, void 0, function () {
        var map, r, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    map = new Map();
                    return [4 /*yield*/, fetch("".concat(base(org), "wit/classificationnodes/Iterations?$depth=10&api-version=7.0"), { headers: { Authorization: basic(pat) } })];
                case 1:
                    r = _b.sent();
                    if (!r.ok)
                        return [2 /*return*/, map];
                    _a = flatten;
                    return [4 /*yield*/, r.json()];
                case 2:
                    _a.apply(void 0, [(_b.sent()), map, { n: 0 }]);
                    return [2 /*return*/, map];
            }
        });
    });
}
function leaf(p) {
    var parts = p.split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : p;
}
function compareIterations(a, b) {
    var _a, _b;
    if ((a === null || a === void 0 ? void 0 : a.startDate) && (b === null || b === void 0 ? void 0 : b.startDate))
        return a.startDate.localeCompare(b.startDate);
    return ((_a = a === null || a === void 0 ? void 0 : a.order) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER) - ((_b = b === null || b === void 0 ? void 0 : b.order) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER);
}
function rankIterations(details, order) {
    var _a, _b, _c;
    var present = new Map();
    for (var _i = 0, details_1 = details; _i < details_1.length; _i++) {
        var d = details_1[_i];
        var p = (_b = (_a = d.fields) === null || _a === void 0 ? void 0 : _a['System.IterationPath']) !== null && _b !== void 0 ? _b : '';
        if (p && !present.has(p))
            present.set(p, (_c = order.get(p)) !== null && _c !== void 0 ? _c : { order: Number.MAX_SAFE_INTEGER });
    }
    var sorted = __spreadArray([], present.keys(), true).sort(function (a, b) { return compareIterations(present.get(a), present.get(b)); });
    return new Map(sorted.map(function (p, i) { return [p, i]; }));
}
export function fetchAssigned(org, pat) {
    return __awaiter(this, void 0, void 0, function () {
        var types, ids, _a, details, order, rank, items, iterations;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, resolveTypes(org, pat)];
                case 1:
                    types = _b.sent();
                    if (!types.length)
                        return [2 /*return*/, { items: [], iterations: [] }];
                    return [4 /*yield*/, assignedIds(org, pat, types)];
                case 2:
                    ids = _b.sent();
                    return [4 /*yield*/, Promise.all([
                            fetchDetails(org, pat, ids),
                            iterationOrder(org, pat),
                        ])];
                case 3:
                    _a = _b.sent(), details = _a[0], order = _a[1];
                    rank = rankIterations(details, order);
                    items = details.map(function (d) {
                        var _a, _b, _c, _d, _e, _f;
                        var f = (_a = d.fields) !== null && _a !== void 0 ? _a : {};
                        var iteration = (_b = f['System.IterationPath']) !== null && _b !== void 0 ? _b : '';
                        return {
                            id: d.id,
                            title: (_c = f['System.Title']) !== null && _c !== void 0 ? _c : '',
                            iteration: iteration,
                            type: (_d = f['System.WorkItemType']) !== null && _d !== void 0 ? _d : '',
                            state: (_e = f['System.State']) !== null && _e !== void 0 ? _e : '',
                            url: "https://dev.azure.com/".concat(org, "/_workitems/edit/").concat(d.id),
                            order: (_f = rank.get(iteration)) !== null && _f !== void 0 ? _f : 0,
                        };
                    });
                    iterations = __spreadArray([], rank.entries(), true).sort(function (a, b) { return a[1] - b[1]; })
                        .map(function (_a) {
                        var path = _a[0], orderIdx = _a[1];
                        return ({ path: path, name: leaf(path), order: orderIdx });
                    });
                    return [2 /*return*/, { items: items, iterations: iterations }];
            }
        });
    });
}
