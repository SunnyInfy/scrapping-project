const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('rightmove_debug.html', 'utf8');
const $ = cheerio.load(html);

console.log('Searching for rent prices...');
$('div').each((i, el) => {
  const text = $(el).text();
  const classes = $(el).attr('class');
  if (text.includes('pcm') && text.length < 50 && classes) {
    console.log('CLASS:', classes, '| TEXT:', text.trim());
  }
});

console.log('\nSearching for standard property card wrappers...');
$('[class*="Card"]').each((i,el) => {
   console.log('Found Card Class:', $(el).attr('class'));
});
