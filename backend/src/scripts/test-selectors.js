const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('rightmove_debug.html', 'utf8');
const $ = cheerio.load(html);

const results = [];

$('[class*="PropertyCard_propertyCardContainerWrapper"]').each((i, el) => {
  const card = $(el);
  const linkAttr = card.find('a[class*="propertyCard-link"]').attr('href');
  if (!linkAttr) return;

  const idMatch = linkAttr.match(/\/properties\/(\d+)/);
  const id = idMatch ? idMatch[1] : `unknown_${i}`;

  const address = card.find('address').text().trim();
  const rawPrice = card.find('[class*="PropertyPrice_price"]').text().trim();
  
  const priceMatch = rawPrice.match(/£([0-9,]+)\s*pcm/i);
  const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;

  let beds = 0;
  // Let's see if we can find bedroom count
  const rawText = card.text().toLowerCase();
  if (rawText.includes('studio')) {
    beds = 0;
  } else {
    const bedMatch = rawText.match(/(\d+)\s*(?:bed|bedroom)/i);
    if (bedMatch) beds = parseInt(bedMatch[1], 10);
  }

  results.push({
    id: `rm_${id}`,
    title: address || 'Property',
    location: { area: address },
    price: { amount: priceAmount, currency: 'GBP', frequency: 'monthly' },
    details: { bedrooms: beds },
    url: `https://www.rightmove.co.uk${linkAttr}`
  });
});

console.log(JSON.stringify(results.slice(0, 3), null, 2));
