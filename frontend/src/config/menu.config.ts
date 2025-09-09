
//todo: based on each role show different menu items
// src/config/menu.js
// Each entry can be either:
//  - a direct link: { text: "Market", to: "/market" }
//  - a dropdown:    { text: "TM Pages", sub: [ { text: "Packages", to: "/tm-packages" }, ... ] }
// case role: then show different menu items
// Farmer: Dashboard, Manage Crops
// TM: Packages, Manage Drivers, Shift Orders
// Admin: User Management, System Settings
//if role is an employee add market at the end with sub items: market,  Orders..


export const MENU = [
  { text: "Market", to: "/market" },
  {
    text: "TM Pages",
    sub: [
      { text: "Packages", to: "/tm-packages" },
      { text: "Manage Drivers", to: "/tm-manage-drivers" },
      { text: "Shift Orders", to: "/tm-shift-orders" },
    ],
  },
  { text: "Farmer", 
    sub:[
        { text: "Dashboard", to: "/farmer/dashboard" },
        { text: "Manage Crops", to: "/farmer/manage-crops" },
    ], 
  },
]
