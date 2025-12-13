const EMOJI_POOL = [
  "😸",
  "📘",
  "📝",
  "🚀",
  "✨",
  "🔥",
  "🌟",
  "📚",
  "💡",
  "🛠️",
  "🎯",
  "🧭",
  "🧠",
  "💻",
  "📈"
] as const;

export function randomEmoji(): string {
  const index = Math.floor(Math.random() * EMOJI_POOL.length);
  return EMOJI_POOL[index];
}
