var db = {
  "products": [
    {
      "id": 1,
      "sku": "GRN-001",
      "name": "Indrayani Basmati Rice 5kg",
      "category": "Staples & Grains",
      "unit": "bag",
      "hsn": "1006",
      "price": 640,
      "stock": 18,
      "reserved": 2,
      "reorderLevel": 10
    },
    {
      "id": 2,
      "sku": "GRN-002",
      "name": "Unpolished Toor Dal 1kg",
      "category": "Staples & Grains",
      "unit": "pkt",
      "hsn": "0713",
      "price": 165,
      "stock": 28,
      "reserved": 0,
      "reorderLevel": 15
    },
    {
      "id": 3,
      "sku": "GRN-003",
      "name": "Kolhapuri Thick Poha 500g",
      "category": "Staples & Grains",
      "unit": "pkt",
      "hsn": "1104",
      "price": 48,
      "stock": 35,
      "reserved": 0,
      "reorderLevel": 20
    },
    {
      "id": 4,
      "sku": "OIL-001",
      "name": "Cold-Pressed Sunflower Oil 1L",
      "category": "Oils & Spices",
      "unit": "btl",
      "hsn": "1512",
      "price": 190,
      "stock": 22,
      "reserved": 4,
      "reorderLevel": 12
    },
    {
      "id": 5,
      "sku": "OIL-002",
      "name": "Cold-Pressed Groundnut Oil 5L",
      "category": "Oils & Spices",
      "unit": "jar",
      "hsn": "1508",
      "price": 1120,
      "stock": 9,
      "reserved": 1,
      "reorderLevel": 8
    },
    {
      "id": 6,
      "sku": "DRY-001",
      "name": "A2 Gir Cow Ghee 500ml",
      "category": "Dairy & Ghee",
      "unit": "jar",
      "hsn": "0405",
      "price": 450,
      "stock": 1,
      "reserved": 0,
      "reorderLevel": 5
    },
    {
      "id": 7,
      "sku": "DRY-002",
      "name": "Pasteurized Table Butter 500g",
      "category": "Dairy & Ghee",
      "unit": "box",
      "hsn": "0405",
      "price": 260,
      "stock": 24,
      "reserved": 0,
      "reorderLevel": 10
    },
    {
      "id": 8,
      "sku": "BEV-001",
      "name": "Assam CTC Masala Chai 250g",
      "category": "Beverages & Packaged",
      "unit": "pkt",
      "hsn": "0902",
      "price": 140,
      "stock": 42,
      "reserved": 0,
      "reorderLevel": 15
    },
    {
      "id": 9,
      "sku": "BEV-002",
      "name": "Filter Coffee Decoction Blend 500g",
      "category": "Beverages & Packaged",
      "unit": "pkt",
      "hsn": "0901",
      "price": 310,
      "stock": 15,
      "reserved": 0,
      "reorderLevel": 8
    },
    {
      "id": 10,
      "sku": "GRN-004",
      "name": "Organic Kolhapuri Jaggery 1kg",
      "category": "Staples & Grains",
      "unit": "block",
      "hsn": "1701",
      "price": 85,
      "stock": 0,
      "reserved": 0,
      "reorderLevel": 15
    },
    {
      "id": 11,
      "sku": "SPC-001",
      "name": "Byadgi Kashmiri Chilli Powder 500g",
      "category": "Oils & Spices",
      "unit": "pkt",
      "hsn": "0904",
      "price": 220,
      "stock": 4,
      "reserved": 3,
      "reorderLevel": 10
    },
    {
      "id": 12,
      "sku": "BEV-003",
      "name": "Kokum Sherbet Concentrate 750ml",
      "category": "Beverages & Packaged",
      "unit": "btl",
      "hsn": "2106",
      "price": 180,
      "stock": 14,
      "reserved": 0,
      "reorderLevel": 6
    }
  ],
  "orders": [
    {
      "id": 1007,
      "date": "04/03/2022",
      "customer": "Suresh Deshmukh",
      "customerId": 4,
      "paymentMode": "khata",
      "status": "pending",
      "items": [
        {
          "id": 6,
          "sku": "DRY-001",
          "name": "A2 Gir Cow Ghee 500ml",
          "hsn": "0405",
          "price": 450,
          "qty": 2
        },
        {
          "id": 4,
          "sku": "OIL-001",
          "name": "Cold-Pressed Sunflower Oil 1L",
          "hsn": "1512",
          "price": 190,
          "qty": 2
        }
      ],
      "coupon": "",
      "subtotal": 1280,
      "discount": 0,
      "tax": 127,
      "total": 1407
    }
  ],
  "customers": [
    {
      "id": 4,
      "name": "Suresh Deshmukh",
      "phone": "94220 77819",
      "type": "Wholesale",
      "gstin": "27AAJFD4412N1Z2",
      "creditLimit": 15000,
      "openingBalance": 1200,
      "totalBilled": 1407,
      "totalSettled": 1000,
      "balance": 1607
    }
  ],
  "nextOrderId": 1009,
  "nextSettlementId": 505
};

module.exports = function () {
  return structuredClone(db);
};
