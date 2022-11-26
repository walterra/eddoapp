const words = [
  'apple',
  'buger',
  'chocolate',
  'donuts',
  'garlic',
  'icecream',
  'ketchup',
  'oranges',
  'pasta',
  'yougurt',
  'quicee',
  'carrot',
  'rice',
  'oliveoil',
  'yam',
  'nut',
  'tomato',
  'vegetables',
  'mutton',
  'spaghetti',
  'wings',
];

export const shuffle = (str: string) => {
  return words[Math.floor(Math.random() * words.length)];
  str = str
    .split('')
    .sort(() => {
      return 0.5 - Math.random();
    })
    .join('');

  let newString = '';
  for (let i = 0; i < str.length; i++) {
    if (96 < str.charCodeAt(i) && str.charCodeAt(i) < 123) {
      newString += String.fromCharCode(str.charCodeAt(i) + 1);
    } else {
      newString += ' ';
    }
  }
  return newString;
};
