const fetch = require('node-fetch');

const PURDUE_API_URL = 'https://api.hfs.purdue.edu/menus/v2/graphql';

class PurdueApi {
  async query(graphqlQuery, variables = {}) {
    try {
      const response = await fetch(PURDUE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('GraphQL query error:', error);
      throw error;
    }
  }

  async getMenu(diningCourt, date) {
    const query = `
      query GetMenu($diningCourt: String!, $date: Date!) {
        menu(diningCourt: $diningCourt, date: $date) {
          date
          diningCourt
          meals {
            name
            stations {
              name
              items {
                id
                name
                isVegetarian
                allergens
                nutrition {
                  calories
                  fat
                  carbs
                  protein
                  sodium
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      diningCourt,
      date
    };

    const result = await this.query(query, variables);
    return result.data?.menu || null;
  }

  async getNutrition(itemId) {
    const query = `
      query GetNutrition($itemId: ID!) {
        item(id: $itemId) {
          id
          name
          nutrition {
            calories
            fat
            carbs
            protein
            sodium
            fiber
            sugar
            cholesterol
            saturatedFat
            transFat
            vitaminA
            vitaminC
            calcium
            iron
          }
          allergens
          ingredients
          servingSize
        }
      }
    `;

    const variables = {
      itemId
    };

    const result = await this.query(query, variables);
    return result.data?.item || null;
  }

  async getAllMenus(date) {
    const courts = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];
    const menus = {};

    const promises = courts.map(async (court) => {
      try {
        const menu = await this.getMenu(court, date);
        menus[court] = menu;
      } catch (error) {
        console.error(`Error fetching menu for ${court}:`, error);
        menus[court] = null;
      }
    });

    await Promise.all(promises);
    return menus;
  }
}

module.exports = new PurdueApi();