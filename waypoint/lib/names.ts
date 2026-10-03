// Deterministic friendly names for anonymous visitors ("Amber Otter").

const ADJ = ["Amber", "Azure", "Brisk", "Calm", "Coral", "Crimson", "Dusky", "Eager", "Fern", "Gentle", "Golden", "Hazel", "Indigo", "Ivory", "Jade", "Keen", "Lilac", "Lucky", "Maple", "Misty", "Noble", "Olive", "Plum", "Quiet", "Rapid", "Rosy", "Sage", "Silver", "Sunny", "Swift", "Teal", "Velvet", "Witty", "Zesty"];
const NOUN = ["Badger", "Bison", "Crane", "Dolphin", "Falcon", "Ferret", "Finch", "Fox", "Gecko", "Heron", "Ibis", "Jaguar", "Koala", "Lemur", "Lynx", "Marten", "Moose", "Newt", "Ocelot", "Otter", "Owl", "Panda", "Puffin", "Quail", "Raven", "Robin", "Seal", "Sparrow", "Tapir", "Tiger", "Walrus", "Wombat", "Yak", "Zebra"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function visitorName(visitorId: string): string {
  const h = hash(visitorId);
  return `${ADJ[h % ADJ.length]} ${NOUN[Math.floor(h / ADJ.length) % NOUN.length]}`;
}
