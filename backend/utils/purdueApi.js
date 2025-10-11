const PURDUE_API_URL = 'https://api.hfs.purdue.edu/menus/v3/GraphQL';

// Dynamic import for node-fetch (ESM module)
let fetch;
const fetchPromise = import('node-fetch').then(module => {
  fetch = module.default;
});

class PurdueApi {
  async query(graphqlQuery, variables = {}, operationName = null) {
    try {
      // Wait for fetch to be loaded
      if (!fetch) {
        await fetchPromise;
      }

      const body = {
        query: graphqlQuery,
        variables
      };
      
      if (operationName) {
        body.operationName = operationName;
      }

      const response = await fetch(PURDUE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
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
    const query = `query getLocationMenu($name: String!, $date: Date!) {
  diningCourtByName(name: $name) {
    dailyMenu(date: $date) {
      meals {
        name
        stations {
          name
          items {
            item {
              itemId
              name
            }
          }
        }
      }
    }
  }
}`;

    const variables = {
      name: diningCourt,
      date
    };

    const result = await this.query(query, variables, 'getLocationMenu');
    return result.data?.diningCourtByName?.dailyMenu || null;
  }

  async getNutrition(itemId) {
    const query = `query ($id: Guid!) {
  itemByItemId(itemId: $id) {
    itemId
    name
    isNutritionReady
    nutritionFacts {
      name
      value
      label
    }
  }
}`;

    const variables = {
      id: itemId
    };

    const result = await this.query(query, variables);
    const item = result.data?.itemByItemId;
    
    if (item && item.nutritionFacts && item.nutritionFacts.length > 0) {
      item.servingSize = item.nutritionFacts[0].label;
    }
    
    return item || null;
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