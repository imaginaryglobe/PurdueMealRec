const API_URL = 'https://api.hfs.purdue.edu/menus/v3/GraphQL';

const query = `
  query getLocationMenu {
    diningCourtByName(name: "Earhart") {
      dailyMenu(date: "2023-10-15") {
        meals {
          stations {
            items {
              item {
                itemId
                name
                nutritionFacts {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(j => console.log(JSON.stringify(j).substring(0, 500))).catch(console.error);
