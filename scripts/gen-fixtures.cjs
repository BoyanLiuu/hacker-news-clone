const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');

function grab(name) {
  const i = src.indexOf(`const ${name} = `);
  let j = src.indexOf('=', i) + 1;
  while (/\s/.test(src[j])) j++;
  const open = src[j], close = open === '[' ? ']' : '}';
  let depth = 0, inStr = null, k = j;
  for (; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (c === '\\') { k++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++; else if (c === close) { depth--; if (!depth) break; }
  }
  return src.slice(j, k + 1);
}
const [P, C, USERS] = new Function(`return [${grab('P')}, ${grab('C')}, ${grab('USERS')}];`)();

const PAD = 10;
const seg = (id) => String(id).padStart(PAD, '0');
const q = (s) => JSON.stringify(s);

// ---- posts: [ageHours, points, author, title, url, text, extra]
const posts = P.map((r, i) => {
  const [ageHours, points, author, title, url, text, ex] = r;
  return {
    id: 38214 + i * 3,
    ageHours,
    points,
    author,
    title,
    url: url || null,
    text: text || null,
    isDead: !!(ex && ex.dead),
    flags: (ex && ex.flags) || 0,
  };
});

// ---- comments: walk the nested trees into flat rows carrying path + depth
let cseq = 41180;
const comments = [];
function walk(postId, list, parentId, parentPath, depth) {
  for (const [author, ageMinutes, score, text, kids, fl] of list) {
    const id = (cseq += 7);
    const path = parentPath ? `${parentPath}.${seg(id)}` : seg(id);
    comments.push({
      id, postId, parentId, author, ageMinutes, score, text, path, depth,
      isDead: !!(fl && fl.dead),
      isDeleted: !!(fl && fl.deleted),
      isShadow: !!(fl && fl.shadow),
    });
    walk(postId, kids || [], id, path, depth + 1);
  }
}
for (const [idx, list] of Object.entries(C)) walk(posts[Number(idx)].id, list, null, null, 0);

// ---- one generated thread, so the depth cap and the long-thread render path have a real target.
// Authored data tops out at 45 comments; M3 needs 300+. Deterministic, seeded, clearly synthetic.
// Attach the filler to the OLDEST story, not the newest: a 300-comment count on a top-ranked row
// would make the front page disagree with its own reference screenshot. An old post ranks low, so
// the long thread is reachable without distorting the listings.
const BIG_POST_ID = posts.reduce((oldest, p) => (p.ageHours > oldest.ageHours ? p : oldest), posts[0]).id;
const voices = ['pgdevlin','kestrel','ivo','marekz','nadia_r','oakes','quill','tsuki','ortolan','yfeng','olm','harrow','smallfry','ivo'];
let rnd = 20261117;
const next = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function add(parentId, parentPath, depth) {
  const id = (cseq += 7);
  const path = parentPath ? `${parentPath}.${seg(id)}` : seg(id);
  comments.push({
    id, postId: BIG_POST_ID, parentId, author: voices[Math.floor(next() * voices.length)],
    // Replies get newer and lower-scored as they go deeper, as real threads do.
    ageMinutes: Math.round(30 + next() * 120 + depth * 12),
    score: Math.max(1, Math.round((1 + next() * 60) / (1 + depth * 0.7))),
    text: 'Generated filler for the long-thread and depth-cap paths, not authored sample copy.',
    path, depth, isDead: false, isDeleted: false, isShadow: false,
  });
  return { id, path };
}

/**
 * Top-heavy, like a real thread: wide at the roots, fan-out decaying with depth. A generator that
 * adds replies at every level until the budget runs out produces an inverted pyramid, which would
 * give M3 a thread shape no reader ever sees.
 */
function grow(parentId, parentPath, depth, budget) {
  let made = 0;
  const expected = Math.max(0, 2.6 - depth * 0.55);
  const kids = Math.min(budget, Math.round(expected * (0.5 + next())));
  for (let i = 0; i < kids && made < budget; i++) {
    const node = add(parentId, parentPath, depth);
    made++;
    if (depth < 9 && made < budget) made += grow(node.id, node.path, depth + 1, budget - made);
  }
  return made;
}

let generated = 0;
for (let r = 0; r < 34 && generated < 320; r++) {
  const root = add(null, null, 0);
  generated++;
  generated += grow(root.id, root.path, 1, 320 - generated);
}

// One deliberate chain past the depth cap, so "continue this thread" has a real target.
let chain = add(null, null, 0);
generated++;
for (let d = 1; d <= 12; d++) {
  chain = add(chain.id, chain.path, d);
  generated++;
}

const emit = (file, body) => fs.writeFileSync(`src/fixtures/${file}`, body);
fs.mkdirSync('src/fixtures', { recursive: true });

emit('users.ts', `// Generated from the approved prototype by scripts/gen-fixtures. Do not hand-edit.
// 14 authored users. Synthetic sample data, as the footer says.
export type RawUser = {
  username: string; created: string; postKarma: number; commentKarma: number;
  about: string; isModerator: boolean; isShadowBanned: boolean; showDead: boolean;
};

export const RAW_USERS: RawUser[] = [
${Object.entries(USERS).map(([u, d]) => `  { username: ${q(u)}, created: ${q(d.created)}, postKarma: ${d.post}, commentKarma: ${d.comment}, about: ${q(d.about || '')}, isModerator: ${!!d.mod}, isShadowBanned: ${!!d.shadow}, showDead: ${!!d.showDead} },`).join('\n')}
];
`);

emit('posts.ts', `// Generated from the approved prototype by scripts/gen-fixtures. Do not hand-edit.
// 69 authored stories. \`ageHours\` is relative: timestamps are computed at module load so the
// ranking and the age column stay alive as you work.
export type RawPost = {
  id: number; ageHours: number; points: number; author: string; title: string;
  url: string | null; text: string | null; isDead: boolean; flags: number;
};

export const RAW_POSTS: RawPost[] = [
${posts.map((p) => `  { id: ${p.id}, ageHours: ${p.ageHours}, points: ${p.points}, author: ${q(p.author)}, title: ${q(p.title)}, url: ${p.url ? q(p.url) : 'null'}, text: ${p.text ? q(p.text) : 'null'}, isDead: ${p.isDead}, flags: ${p.flags} },`).join('\n')}
];
`);

emit('comments.ts', `// Generated from the approved prototype by scripts/gen-fixtures. Do not hand-edit.
// Flat rows carrying path and depth, exactly as Postgres will return them in phase 2, so the
// service swap in M7 changes no shape. ${comments.length - generated} authored + ${generated} generated
// filler on post ${BIG_POST_ID} for the long-thread and depth-cap paths.
export type RawComment = {
  id: number; postId: number; parentId: number | null; author: string; ageMinutes: number;
  score: number; text: string; path: string; depth: number;
  isDead: boolean; isDeleted: boolean; isShadow: boolean;
};

export const RAW_COMMENTS: RawComment[] = [
${comments.map((c) => `  { id: ${c.id}, postId: ${c.postId}, parentId: ${c.parentId ?? 'null'}, author: ${q(c.author)}, ageMinutes: ${c.ageMinutes}, score: ${c.score}, text: ${q(c.text)}, path: ${q(c.path)}, depth: ${c.depth}, isDead: ${c.isDead}, isDeleted: ${c.isDeleted}, isShadow: ${c.isShadow} },`).join('\n')}
];
`);

const byPost = {};
for (const c of comments) byPost[c.postId] = (byPost[c.postId] || 0) + 1;
console.log(JSON.stringify({
  users: Object.keys(USERS).length, posts: posts.length,
  comments: comments.length, authored: comments.length - generated, generated,
  biggestThread: Math.max(...Object.values(byPost)),
  deepest: Math.max(...comments.map((c) => c.depth)),
}, null, 2));
