const yahooFinance = require('yahoo-finance');
const notifier = require('node-notifier');
const blessed = require('blessed')
const contrib = require('blessed-contrib');
const argv = require('minimist')(process.argv.slice(2));
const table = require('./table');
const path = require('path');

contrib.table = table;

if (! argv._ ) {
  console.log("ERROR - You should provide at least one symbol. Example: node index.js BRL=X EURBRL=X");
  process.exit(1);
}

const screen = blessed.screen();
let grid = new contrib.grid({
  rows: 12,
  cols: 12,
  screen: screen
});

const QUOTE_STATUS = {
    initial: {
        status: "EVEN",
        color: [160, 160, 25] // yellow
    },
    up: {
        status: " UP ",
        color: [28, 188, 57] // green
    },
    down: {
        status: "DOWN",
        color: [188, 28, 28] // red
    }
};
const symbols = argv._;
let selectedMonitor = 0;

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

function fetchQuote(symbol) {
  return yahooFinance.quote({
    symbol: symbol,
    modules: ['price']
  });
};

function parse(quote) {
    return {
      symbol: quote.price.symbol,
      currency: quote.price.currencySymbol,
      current: quote.price.regularMarketPrice,
      open: quote.price.regularMarketOpen,
      changePercent: quote.price.regularMarketChangePercent,
      change: quote.price.regularMarketChange,
      highest: quote.price.regularMarketDayHigh,
      lowest: quote.price.regularMarketDayLow
    };
};

function createSymbolLine(symbol, position, size) {
  let line = grid.set(position.x, position.y, size.height, size.width, contrib.line, {
    label: `Currency Wacther - ${symbol}`,
    showLegend: true,
    legend: {
        width: 10
    },
    minY: 0,
    numYLabels: 12
  });

  return line;
};

function createSymbolMonitor(symbol, position, size) {
  let monitor = grid.set(position.x, position.y, size.height, size.width, contrib.table, {
    label: `${symbol} Monitor`,
    keys: true,
    columnSpacing: 10,
    columnWidth: [15, 6],
    interactive: false,
  });

  return monitor;
};

function createNotificationMonitor(symbol, position, size) {
  let monitor = grid.set(position.x, position.y, size.height, size.width, contrib.table, {
    label: `${symbol} Notifications`,
    keys: true,
    columnSpacing: 10,
    columnWidth: [15, 10],
    interactive: true
  });
  monitor.notification = false;
  monitor.highValue = monitor.lowValue = 0.000;
  monitor.initiated = false;

  return monitor;
};

function createSymbolLCDStatus(symbol, position, size) {
  let initial = QUOTE_STATUS.initial;
  return grid.set(position.x, position.y, size.height, size.width, contrib.lcd, {
    label: `${symbol} Status`,
    display: initial.status,
    color: initial.color,
    elementPadding: 2,
    elements: 4
  });
};

function createDashboards() {
  return symbols.map((symbol, index) => {
    const lineHeight = 12 / symbols.length;
    const increment = index * lineHeight;

    let symbolDashboard = {};
    let position = { y: 0 , x: 0 + increment };
    let size = { height: lineHeight, width: 10 };
    symbolDashboard.line = createSymbolLine(symbol, position, size);
    
    position.y += size.width;
    size = { height: lineHeight/2, width: 2 };
    symbolDashboard.monitor = createSymbolMonitor(symbol, position, size);

    position.x += size.height;
    size = { height: lineHeight/4, width: 2 };
    symbolDashboard.notificationMonitor = createNotificationMonitor(symbol, position, size);
    
    position.x += size.height;
    size = { height: lineHeight/4, width: 2 };
    symbolDashboard.lcdStatus = createSymbolLCDStatus(symbol, position, size);
    
    symbolDashboard.symbol = symbol;
    symbolDashboard.lineData = {
      title: symbol,
      x: [],
      y: [],
      style: {
          line: QUOTE_STATUS.initial.color
      }
    };

    symbolDashboard.notificationMonitor.setData({
      headers: [],
       data: [
          ['Notification', symbolDashboard.notificationMonitor.notification ],
          ['Low', "Loading..." ],
          ['High', "Loading..." ],
        ]
    });

    symbolDashboard.line.setData(symbolDashboard.lineData);

    return symbolDashboard;
  });
};

function currentStatus (open, current) {
  switch (true) {
        case (open > current):
          return QUOTE_STATUS.down;
        case (open < current):
          return QUOTE_STATUS.up;
        default:
          return QUOTE_STATUS.initial;
      }
};

function format(num, place = 4) {
  return num.toFixed(place);
};

function notify(price, title, monitor) {
    notifier.notify({
      title: title,
      message: `Currently worth ${price.currency} ${format(price.current)}`,
      icon: path.join(__dirname, 'icon.png'),
      actions: ["Snooze this stock", "Snooze all notifications"]
    }, function (error, response, metadata) {
      if (metadata.activationValue) {

        switch(metadata.activationValue) {
          case "Snooze this stock":
            monitor.notification = false;
            updateMonitor(monitor);
            break;
          case "Snooze all notifications":
            dashboards.forEach(dashboard => {
              dashboard.notificationMonitor.notification = false;
              updateMonitor(dashboard.notificationMonitor);
            });
            break;
        }
      }
    });
}

function updateMonitor(monitor) {
    monitor.setData({
      headers: [],
      data: [
        ['Notification', monitor.notification ],
        ['Low', format(monitor.lowValue) ],
        ['High', format(monitor.highValue) ],
      ]
    });

    screen.render();    
};

function watch(dashboards) {
  dashboards.forEach((dashboard) => {
    fetchQuote(dashboard.symbol).then(parse).then((price) => {
      let symbolStatus = currentStatus(price.open, price.current);

      // Line Update
      dashboard.lineData.style.line = symbolStatus.color;

      if (dashboard.lineData.x.length == 0) {
        dashboard.lineData.x.push("Open");
        dashboard.lineData.y.push(price.open);
      }

      dashboard.lineData.x.push(dashboard.lineData.x.length.toString());
      dashboard.lineData.y.push(price.current);
      dashboard.line.setData(dashboard.lineData);

      // Monitor Update
      dashboard.monitor.setData({
        headers: [],
        data: [
            ['Current Price', format(price.current) ],
            ['Open Price', format(price.open) ],
            ['Variation %', format(price.changePercent * 100 ) ],
            [`Variation ${price.currency}`, format(price.change) ],
            ['Highest', format(price.highest) ],
            ['Lowest', format(price.lowest) ],
        ]
      });

      //Notitication Update
      let monitor = dashboard.notificationMonitor;
      if (! monitor.initiated) {
        monitor.lowValue = price.current * .99;
        monitor.highValue = price.current * 1.01;
        monitor.initiated = true;

        monitor.setData({
          headers: [],
          data: [
            ['Notification', monitor.notification ],
            ['Low', format(monitor.lowValue) ],
            ['High', format(monitor.highValue) ],
          ]
        });
      } else {
        if (monitor.notification) {

          if (price.current >= monitor.highValue) {
            notify(price, `${dashboard.symbol}: value higher than expected`, monitor);
          }

          if (monitor.lowValue > price.current) {
            notify(price, `${dashboard.symbol}: value below than expected`, monitor);
          }

        }
      }

      // LCD Update
      dashboard.lcdStatus.setOptions({ color: symbolStatus.color });
      dashboard.lcdStatus.setDisplay(symbolStatus.status);

      screen.render();
    });
  });

};

let dashboards = createDashboards(symbols);
watch(dashboards);
dashboards[selectedMonitor].notificationMonitor.focus();
screen.render();

screen.key(['left'], function(ch, key) {
  let monitor = dashboards[selectedMonitor].notificationMonitor;
  let option = monitor.children[1].selected;

  if (monitor.initiated) {
    switch(option) {
    case 0:
      monitor.notification = ! monitor.notification;
      break;
    case 1:
      if (monitor.highValue > (monitor.lowValue - 0.01))
        monitor.lowValue -= 0.01;
      break;
    case 2:
      if ((monitor.highValue - 0.01) > monitor.lowValue)
        monitor.highValue -= 0.01;
      break;
  }

  updateMonitor(monitor);
}

});

screen.key(['right'], function(ch, key) {
  let monitor = dashboards[selectedMonitor].notificationMonitor;
  let option = monitor.children[1].selected;

  if (monitor.initiated) {
    switch(option) {
      case 0:
        monitor.notification = ! monitor.notification;
        break;
      case 1:
        if (monitor.highValue > (monitor.lowValue + 0.01))
          monitor.lowValue += 0.01;
        break;
      case 2:
        if ((monitor.highValue + 0.01) > monitor.lowValue)
          monitor.highValue += 0.01;
        break;
    }
  }

  updateMonitor(monitor);
});

screen.key(['space'], function(ch, key) {
  selectedMonitor ++;
  if (selectedMonitor >= dashboards.length)
    selectedMonitor = 0;

  monitor = dashboards[selectedMonitor].notificationMonitor;
  monitor.focus();

  screen.render();
});

setInterval(() => {
  watch(dashboards);
}, 10000);