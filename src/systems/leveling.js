export function expThreshold(level) {
  return level * 50;
}

export function applyLevelUps(character) {
  let leveledUp = false;
  while (character.exp >= expThreshold(character.level)) {
    character.exp -= expThreshold(character.level);
    character.level += 1;
    character.skillPoints += 1;
    leveledUp = true;
  }
  return leveledUp;
}
