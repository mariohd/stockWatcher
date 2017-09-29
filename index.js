const yahooFinance = require('yahoo-finance');
const notifier = require('node-notifier');
const blessed = require('blessed')
const contrib = require('blessed-contrib');

const screen = blessed.screen();

var grid = new contrib.grid({
    rows: 12,
    cols: 12,
    screen: screen
})

const symbols = ['BRL=X', 'EURBRL=X'];

let USDLine = grid.set(0, 0, 6, 10, contrib.line, {
    label: 'Currency Wacther - USD',
    showLegend: true,
    legend: {
        width: 10
    },
    minY: 3.10,
    numYLabels: 12
});

let USDMonitor = grid.set(0, 10, 3, 2, contrib.table, {
    label: 'USD Monitor',
    keys: true,
    columnSpacing: 1,
    columnWidth: [17, 8, 8],
    interactive: false
});

USDMonitor.on('click', (data) => {
    notification = false;
    screen.render();
});

notification = true;

let USDLCD = grid.set(3, 10, 3, 2, contrib.lcd,
       { display: 'EVEN', color: 'yellow', elementPadding: 2, elements: 4 });

let EURLine = grid.set(6, 0, 6, 10, contrib.line, {
    label: 'Currency Wacther - EUR',
    showLegend: true,
    legend: {
        width: 10
    },
    minY: 3.60,
    numYLabels: 12
});

let EURMonitor = grid.set(6, 10, 3, 2, contrib.table, {
    label: 'EUR Monitor',
    keys: true,
    columnSpacing: 1,
    columnWidth: [17, 8, 8],
    interactive: false
});

let EURLCD = grid.set(9, 10, 3, 2, contrib.lcd,
       { display: 'EVEN', color: 'yellow', elementPadding: 2, elements: 4 });

const data = symbols.map(s => {
    return {
        title: s,
        x: [],
        y: [],
        style: {
            line: 'yellow'
        }
    };
});

/*
price: 
   { maxAge: 1,
     regularMarketChangePercent: -0.0056250365,
     regularMarketChange: -0.01789999,
     regularMarketTime: 2017-09-29T14:48:45.000Z,
     priceHint: 4,
     regularMarketPrice: 3.1643,
     regularMarketDayHigh: 3.1899,
     regularMarketDayLow: 3.1494,
     regularMarketVolume: 0,
     averageDailyVolume10Day: 0,
     averageDailyVolume3Month: 0,
     regularMarketPreviousClose: 3.1822,
     regularMarketSource: 'DELAYED',
     regularMarketOpen: 3.182,
     exchange: 'CCY',
     exchangeName: 'CCY',
     marketState: 'REGULAR',
     quoteType: 'CURRENCY',
     symbol: 'BRL=X',
     underlyingSymbol: null,
     shortName: 'USD/BRL',
     longName: null,
     currency: 'BRL',
     quoteSourceName: 'Delayed Quote',
     currencySymbol: 'R$' 
} }
*/

USDLine.setData(data[0]);
EURLine.setData(data[1]);

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

screen.render()

let limits = {
    max: '0,5%',
    min: '-0,5%'
}

for (var p = 2; p <= process.argv.length; p += 2) {

    if (/^--min$/.test(process.argv[p])) {
        limits.min = parseFloat(process.argv[p + 1]);
    }

    if (/^--max$/.test(process.argv[p])) {
        limits.max = parseFloat(process.argv[p + 1]);
    }
};

/*
notifier.notify({
    'title': 'Currency Watcher',
    'message': `Starting to monitor limits between ${limits.min} and ${limits.max}`
});
*/

function verify() {
    symbols.forEach((s) => {
        yahooFinance.quote({
            symbol: s,
            modules: ['price', 'summaryDetail']
        }, function(err, quotes) {
            if (err) {} else {
                if (quotes) {
                    let current = quotes.price.regularMarketPrice;

                    /* 
                    if (typeof limits.max !== "number") limits.max = quotes.price.regularMarketOpen * 1.005
                    if (current >= limits.max) {
                        notifier.notify({
                            'title': 'Hora de ficar rico',
                            'message': `RUN!! tá custando ${current} =)`
                        });
                    }

                    if (typeof limits.min !== "number") limits.min = quotes.price.regularMarketOpen * 0.995
                    if (current <= limits.min) {
                        notifier.notify({
                            'title': 'A liseira bateu e ficou',
                            'message': `Perdendo!! tá custando ${current} =(`
                        });
                    }
                    */

                    let hist = data.filter(hist => s == hist.title)[0];

                    if (hist.x.length == 0) {
                        hist.x.push("Open");
                        hist.y.push(quotes.price.regularMarketOpen);
                    }

                    hist.x.push(hist.x.length.toString());
                    hist.y.push(current);

                    if (quotes.price.regularMarketOpen > current) {
                        hist.style.line = 'red';
                    } else {
                        hist.style.line = 'green';
                    }

                    if (s == 'BRL=X') {
                        USDLCD.setOptions({color: current > quotes.price.regularMarketOpen ? 'green' : 'red' });
                        USDLCD.setDisplay(current > quotes.price.regularMarketOpen ? ' UP ' : 'DOWN');

                        USDLine.setData(hist);

                        USDMonitor.setData({
                            headers: [],
                            data: [
                                ['Current Price', current.toFixed(4)],
                                ['Open Price', quotes.price.regularMarketOpen.toFixed(4)],
                                ['Variation %', (quotes.price.regularMarketChangePercent * 100).toFixed(4)],
                                [`Variation ${quotes.price.currencySymbol}`, quotes.price.regularMarketChange.toFixed(4)],
                                ['Highest', quotes.price.regularMarketDayHigh.toFixed(4)],
                                ['Lowest', quotes.price.regularMarketDayLow.toFixed(4)],
                            ]
                        });
                    } else {
                        EURLCD.setOptions({color: current > quotes.price.regularMarketOpen ? 'green' : 'red' });
                        EURLCD.setDisplay(current > quotes.price.regularMarketOpen ? ' UP ' : 'DOWN');

                        EURLine.setData(hist);

                        EURMonitor.setData({
                            headers: [],
                            data: [
                                ['Current Price', current.toFixed(4)],
                                ['Open Price', quotes.price.regularMarketOpen.toFixed(4)],
                                ['Variation %', (quotes.price.regularMarketChangePercent * 100).toFixed(4)],
                                [`Variation ${quotes.price.currencySymbol}`, quotes.price.regularMarketChange.toFixed(4)],
                                ['Highest', quotes.price.regularMarketDayHigh.toFixed(4)],
                                ['Lowest', quotes.price.regularMarketDayLow.toFixed(4)],
                                ['        ', '          '],
                                ['Notification', notification],
                            ]
                        });
                    }
                    screen.render();
                }
            }
        });
    });
}

verify();
setInterval(verify, 5000);

screen.on('resize', function() {
    USDLine.emit('attach');
    EURLine.emit('attach');
});