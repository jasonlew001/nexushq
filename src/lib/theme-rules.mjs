// Theme + personal-post rules, shared by scripts/import-inspiration.mjs
// (library posts) and the own-post sync (src/lib/own-posts.ts), so our posts
// and the library are tagged the same way. Plain .mjs so the Node script can
// import it without a build step. Keys must match INSPO_THEMES in
// src/lib/constants.ts.

// What a post teaches or covers, for the Insights view. First match wins, so
// specific themes sit above broad ones (a slice fix is "fixes", not "swing").
// Matched on caption + hashtags, then the search that found it as a fallback.
export const THEMES = [
  // recruiting
  ["contacting-coaches", /email(ing)? (college )?coach|coach(es)? email|message coaches|dm(ing)? coaches|reach(ing)? out to coaches|recruiting email|subject line/i],
  ["what-coaches-want", /what (college )?coaches (look|want|see)|coaches look for|coaches want|stand out to coaches/i],
  ["school-fit", /school list|college list|(college|program|school|academic|athletic) fit|d1 vs|\bd[123]\b.*\bd[123]\b|naia|juco|division (1|2|3|i)\b|right (school|program|college)/i],
  ["scholarships", /scholarship|athletic (aid|money)|financial aid|full ride/i],
  ["commitment-signing", /\bcommit(ted|ment)?\b|signing day|signed (with|to)|\bnli\b/i],
  ["tournaments-showcases", /tournament|showcase|\bajga\b|\bexposure\b|junior tour/i],
  ["recruiting-process", /recruit|timeline|play college golf|college golf|get recruited|ncaa (rules|calendar)/i],
  ["sports-parents", /\bparents?\b|golf (mom|dad)|sports (mom|dad)/i],
  ["student-athlete-life", /student.?athlete|college athlete|balanc(e|ing) (school|sports)|athlete life/i],
  // memes before skills: a meme about putting is a meme
  ["humor", /funny|meme|humou?r|\blol\b|😂|🤣|joke|relatable|comedy/i],
  // golf skill
  ["fixes", /\bslice\b|\bhook\b|shank|topping|chunk|\bfat\b|\bthin\b|\bfix\b|stop (hitting|slicing)/i],
  ["putting", /\bputt|green reading|\blag\b/i],
  ["short-game", /\bchip|\bpitch|\bwedges?\b|bunker|short game|around the green|flop/i],
  ["driver", /\bdriver\b|tee shot|\bdistance\b|swing speed|\bdrives?\b/i],
  ["irons", /\birons?\b|ball striking|compress|\bstrike\b/i],
  ["setup-grip", /\bgrip\b|posture|\bsetup\b|\bstance\b|alignment|ball position/i],
  ["range-practice", /range session|practice (plan|routine|session|drill)|\bdrills?\b|practice like|range day/i],
  ["course-strategy", /course management|strategy|break (70|80|90|100)|scoring|lower (your )?(handicap|score)|\bhandicap\b/i],
  ["mental-game", /mental|confidence|nerves|pressure|\bfocus\b|mindset|routine/i],
  ["fitness", /fitness|workout|\bgym\b|stretch|mobility|warm ?up|strength/i],
  ["swing-basics", /\bswing\b|backswing|downswing|takeaway|rotation|tempo|sequenc/i],
  ["beginner", /beginner|new to golf|starting golf|\bbasics\b/i],
  ["equipment", /club fitting|equipment|\bshaft\b|golf balls?\b|\bclubs\b/i],
];

// Posts that work because of who posted them — excluded from "what can we
// copy". Memes stay ("humor" is a copyable format); diaries and POVs don't.
export const PERSONAL_RE =
  /\bpov\b|day in (my|the) life|\bditl\b|i (just |officially )?committed|officially committed|\bmy (first|last|dad|mom|boyfriend|girlfriend|husband|wife|son|daughter|journey|story)\b|grwm|storytime|\bvlog\b|birthday|throwback|\bootd\b|outfit/i;

// The post's own words first; the search that found it only as a fallback
// (searches pull in loosely related posts, so they shouldn't override).
// Humor is judged on the caption alone: creators tag real tips posts
// #funny / #golfhumor for reach, which would bury them under memes.
export function themeOf(r) {
  const caption = r.caption ?? "";
  const own = `${caption} ${r.hashtags.join(" ")}`;
  const match = (text, captionOnly) =>
    THEMES.find(([key, re]) => (key === "humor" ? re.test(captionOnly ?? text) : re.test(text)))?.[0] ?? null;
  return match(own, caption.replace(/#\S+/g, "")) ?? match(r.source_query ?? "", "");
}
