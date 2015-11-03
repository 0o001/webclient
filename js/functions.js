var inherits = (function() {
    var createObject = Object.create || function createObject(source) {
        var Host = function() {};
        Host.prototype = source;
        return new Host();
    };

    return function(destination, source) {
        var proto = destination.prototype = createObject(source.prototype);
        proto.constructor = destination;
        proto._super = source.prototype;
    };
})();

makeEnum(['MDBOPEN'], 'MEGAFLAG_', window);

/**
 * Safely parse an HTML fragment, removing any executable
 * JavaScript, and return a document fragment.
 *
 * @param {string} markup The HTML fragment to parse.
 * @param {boolean} forbidStyle If true, disallow <style> nodes and
 *     style attributes in the parsed fragment. Gecko 14+ only.
 * @param {Document} doc The document in which to create the
 *     returned DOM tree.
 * @param {nsIURI} baseURI The base URI relative to which resource
 *     URLs should be processed. Note that this will not work for
 *     XML fragments.
 * @param {boolean} isXML If true, parse the fragment as XML.
 * @returns {DocumentFragment}
 */
function parseHTML(markup, forbidStyle, doc, baseURI, isXML) {
    if (!doc) {
        doc = document;
    }
    if (is_chrome_firefox) {
        try {
            var flags = 0;
            if (!forbidStyle) {
                flags |= mozParserUtils.SanitizerAllowStyle;
            }
            if (!baseURI) {
                var href = getAppBaseUrl();
                if (!parseHTML.baseURIs[href]) {
                    parseHTML.baseURIs[href] =
                        Services.io.newURI(href, null, null);
                }
                baseURI = parseHTML.baseURIs[href];
            }
            // XXX: parseFragment() removes href attributes with a hash mask
            markup = String(markup).replace(/\shref="#/g, ' data-fxhref="#');
            return mozParserUtils.parseFragment(markup, flags, Boolean(isXML),
                                                baseURI, doc.documentElement);
        }
        catch (ex) {
            mozError(ex);
        }
    }

    // Either we are not running the Firefox extension or the above parser
    // failed, in such case we try to mimic it using jQuery.parseHTML
    var fragment = doc.createDocumentFragment();
    $.parseHTML(String(markup), doc)
        .forEach(function(node) {
            fragment.appendChild(node);
        });
    return fragment;
}
parseHTML.baseURIs = {};

/**
 * Handy printf-style parseHTML to apply escapeHTML
 * @param {string} markup The HTML fragment to parse.
 * @param {...*} var_args
 */
function parseHTMLfmt(markup) {
    if (arguments.length > 1) {
        var args = toArray(arguments);
        var replacer = function(match) {
            return escapeHTML(args.shift());
        };
        args.shift();
        markup = markup.replace(/@@/g, replacer);
    }
    return parseHTML(markup);
}

/**
 * Safely inject an HTML fragment using parseHTML()
 * @param {string} markup The HTML fragment to parse.
 * @param {...*} var_args
 * @see This should be used instead of jQuery.html()
 * @example $(document.body).safeHTML('<script>alert("XSS");</script>It Works!');
 * @todo Safer versions of append, insert, before, after, etc
 */
(function($fn, obj) {
    for (var fn in obj) {
        if (obj.hasOwnProperty(fn)) {
            /* jshint -W083 */
            (function(origFunc, safeFunc) {
                Object.defineProperty($fn, safeFunc, {
                    value: function $afeCall(markup) {
                        var i = 0;
                        var l = this.length;
                        markup = parseHTMLfmt.apply(null, arguments);
                        while (l > i) {
                            $(this[i++])[origFunc](markup.cloneNode(true));
                        }
                        if (is_chrome_firefox) {
                            $('a[data-fxhref]').rebind('click', function() {
                                if (!$(this).attr('href')) {
                                    location.hash = $(this).data('fxhref');
                                }
                            });
                        }
                        return this;
                    }
                });
                safeFunc = undefined;
            })(fn, obj[fn]);
        }
    }
    $fn = obj = undefined;
})($.fn, {
    'html': 'safeHTML',
    'append': 'safeAppend'
});

/**
 * Escape HTML markup
 * @param {string} str The HTML fragment to parse.
 * NB: This should be the same than our legacy `htmlentities`
 *     function, except that it's faster and deals with quotes
 */
function escapeHTML(str) {
    return String(str).replace(/[&"'<>]/g, function(match) {
        return escapeHTML.replacements[match];
    });
}
escapeHTML.replacements = { "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };

/**
 *  Check if value is contained in a array. If it is return value
 *  otherwise false
 */
function anyOf(arr, value) {
    return $.inArray(value, arr) === -1 ? false : value;
}

/**
 * excludeIntersected
 *
 * Loop through arrays excluding intersected items form array2
 * and prepare result format for tokenInput plugin item format.
 *
 * @param {Array} array1, emails used in share
 * @param {Array} array2, list of all available emails
 *
 * @returns {Array} item An array of JSON objects e.g. { id, name }.
 */
function excludeIntersected(array1, array2) {

    var result = [],
        tmpObj2 = array2;

    if (!array1) {
        return array2;
    }
    else if (!array2) {
        return array1;
    }

    // Loop through emails used in share
    for (var i in array1) {
        if (array1.hasOwnProperty(i)) {

            // Loop through list of all emails
            for (var k in array2) {
                if (array2.hasOwnProperty(k)) {

                    // Remove matched email from result
                    if (array1[i] === array2[k]) {
                        tmpObj2.splice(k, 1);
                        break;
                    }
                }
            }
        }
    }

    // Prepare for token.input plugin item format
    for (var n in tmpObj2) {
        if (tmpObj2.hasOwnProperty(n)) {
            result.push({ id: tmpObj2[n], name: tmpObj2[n] });
        }
    }

    return result;
}

/**
 *  Cascade:
 *
 *  Tiny helper to queue related tasks, in which the output of one function
 *  is the input of the next task. It is asynchronous
 *
 *      function([prevarg, arg], next)
 *
 *  Author: @crodas
 */
function Cascade(tasks, fnc, done, value) {
    function scheduler(value) {
        if (tasks.length === 0) {
            return done(value);
        }

        fnc([value, tasks.shift()], scheduler)
    }

    scheduler(value);
}

/**
 *  Simple interface to run things in parallel (safely) once, and
 *  get a safe callback
 *
 *  Author: @crodas
 */
function Parallel(task) {
    var callbacks = {};
    return function(args, next) {
        var id = JSON.stringify(args)
        if (callbacks[id]) {
            return callbacks[id].push(next);
        }
        callbacks[id] = [next];
        task(args, function() {
            var args = arguments;
            $.each(callbacks[id], function(i, next) {
                next.apply(null, args);
            });
            delete callbacks[id];
        });
    };
}

function asciionly(text) {
    var rforeign = /[^\u0000-\u007f]/;
    if (rforeign.test(text)) {
        return false;
    }
    else {
        return true;
    }
}

function Later(callback) {
    if (typeof callback !== 'function') {
        throw new Error('Invalid function parameter.');
    }

    return setTimeout(function() {
        callback();
    }, 1000);
}

var Soon = is_chrome_firefox ? mozRunAsync : function(callback) {
    if (typeof callback !== 'function') {
        throw new Error('Invalid function parameter.');
    }

    return setTimeout(function() {
        callback();
    }, 20);
};

function SoonFc(func, ms) {
    return function __soonfc() {
        var self = this,
            args = arguments;
        if (func.__sfc) {
            clearTimeout(func.__sfc);
        }
        func.__sfc = setTimeout(function() {
            delete func.__sfc;
            func.apply(self, args);
        }, ms || 122);
    };
}

function jScrollFade(id) {

    $(id + ' .jspTrack').rebind('mouseover', function(e) {
        $(this).find('.jspDrag').addClass('jspActive');
        $(this).closest('.jspContainer').uniqueId();
        jScrollFadeOut($(this).closest('.jspContainer').attr('id'));
    });

    if (!$.jScroll) {
        $.jScroll = {};
    }
    for (var i in $.jScroll) {
        if ($.jScroll[i] === 0) {
            delete $.jScroll[i];
        }
    }
    $(id).rebind('jsp-scroll-y.fade', function(event, scrollPositionY, isAtTop, isAtBottom) {
            $(this).find('.jspDrag').addClass('jspActive');
            $(this).find('.jspContainer').uniqueId();
            var id = $(this).find('.jspContainer').attr('id');
            jScrollFadeOut(id);
        });
}

function jScrollFadeOut(id) {
    if (!$.jScroll[id]) {
        $.jScroll[id] = 0;
    }
    $.jScroll[id]++;
    setTimeout(function(id) {
        $.jScroll[id]--;
        if ($.jScroll[id] === 0) {
            $('#' + id + ' .jspDrag').removeClass('jspActive');
        }
    }, 500, id);
}

function inputfocus(id, defaultvalue, pw) {
    if (pw) {
        $('#' + id)[0].type = 'password';
    }
    if ($('#' + id)[0].value === defaultvalue) {
        $('#' + id)[0].value = '';
    }
}

function inputblur(id, defaultvalue, pw) {
    if ($('#' + id)[0].value === '') {
        $('#' + id)[0].value = defaultvalue;
    }
    if (($('#' + id)[0].value === defaultvalue) && (pw)) {
        $('#' + id)[0].type = 'text';
    }
}

function easeOutCubic(t, b, c, d) {
    return c * ((t = t / d - 1) * t * t + 1) + b;
}

function ellipsis(text, location, maxCharacters) {
    if (text.length > 0 && text.length > maxCharacters) {
        if (typeof(location) === 'undefined') {
            location = 'end';
        }
        switch (location) {
            case 'center':
                var center = (maxCharacters / 2);
                text = text.slice(0, center) + '...' + text.slice(-center);
                break;
            case 'end':
                text = text.slice(0, maxCharacters - 3) + '...';
                break;
        }
    }
    return text;
}

/**
 * Convert all instances of [$nnn] e.g. [$102] to their localized strings
 * @param {String} html The html markup
 * @returns {String}
 */
function translate(html) {

    /**
     * String.replace callback
     * @param {String} match The whole matched string
     * @param {Number} localeNum The locale string number
     * @param {String} namespace The operation, if any
     * @returns {String} The localized string
     */
    var replacer = function(match, localeNum, namespace) {
        if (namespace) {
            match = localeNum + '.' + namespace;

            if (namespace === 'dq') {
                // Replace double quotes to their html entities
                l[match] = String(l[localeNum]).replace(/"/g, '&quot;');
            }
            else if (namespace === 'q') {
                // Escape single quotes
                l[match] = String(l[localeNum]).replace(/'/g, "\\'");
            }
            else if (namespace === 'dqq') {
                // Both of the above
                l[match] = String(l[localeNum]).replace(/"/g, '&quot;');
                l[match] = l[match].replace(/'/g, "\\'");
            }

            return l[match];
        }
        return String(l[localeNum]);
    };

    return String(html).replace(/\[\$(\d+)(?:\.(\w+))?\]/g, replacer);
}

function megatitle(nperc) {
    if (!nperc) {
        nperc = '';
    }
    var a = parseInt($('.notification-num:first').text());
    if (a > 0) {
        a = '(' + a + ') ';
    }
    else {
        a = '';
    }
    if (document.title !== a + 'MEGA' + nperc) {
        document.title = a + 'MEGA' + nperc;
    }
}

function populate_l() {
    // for (var i = 7000 ; i-- ; l[i] = l[i] || '(null)');
    l[0] = 'Mega Limited ' + new Date().getFullYear();
    if ((lang === 'es') || (lang === 'pt') || (lang === 'sk')) {
        l[0] = 'Mega Ltd.';
    }
    l[1] = l[398];
    if (lang === 'en') {
        l[1] = 'Go Pro';
    }
    l[438] = l[438].replace('[X]', '');
    l['439a'] = l[439];
    l[439] = l[439].replace('[X1]', '').replace('[X2]', '');
    l['466a'] = l[466];
    l[466] = l[466].replace('[X]', '');
    l[543] = l[543].replace('[X]', '');
    l[456] = l[456].replace(':', '');
    l['471a'] = l[471].replace('[X]', 10);
    l['471b'] = l[471].replace('[X]', 100);
    l['471c'] = l[471].replace('[X]', 250);
    l['471d'] = l[471].replace('[X]', 500);
    l['471e'] = l[471].replace('[X]', 1000);
    l['469a'] = l[469].replace('[X]', 10);
    l['469b'] = l[469].replace('[X]', 100);
    l['469c'] = l[469].replace('[X]', 250);
    l['472a'] = l[472].replace('[X]', 10);
    l['472b'] = l[472].replace('[X]', 100);
    l['472c'] = l[472].replace('[X]', 250);
    l['208a'] = l[208].replace('[A]', '<a href="#terms" class="red">');
    l['208a'] = l['208a'].replace('[/A]', '</a>');
    l[208] = l[208].replace('[A]', '<a href="#terms">');
    l[208] = l[208].replace('[/A]', '</a>');
    l[517] = l[517].replace('[A]', '<a href="#help">').replace('[/A]', '</a>');
    l[521] = l[521].replace('[A]', '<a href="#copyright">').replace('[/A]', '</a>');
    l[553] = l[553].replace('[A]', '<a href="mailto:resellers@mega.nz">').replace('[/A]', '</a>');
    l[555] = l[555].replace('[A]', '<a href="#terms">').replace('[/A]', '</a>');
    l[754] = l[754].replace('[A]',
        '<a href="http://www.google.com/chrome" target="_blank" rel="noreferrer" style="color:#D9290B;">');
    l[754] = l[754].replace('[/A]', '</a>');
    l[871] = l[871].replace('[B]',
        '<strong>').replace('[/B]', '</strong>').replace('[A]', '<a href="#pro">').replace('[/A]', '</a>');
    l[924] = l[924].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[501] = l[501].replace('17', '').replace('%', '');
    l[1066] = l[1066].replace('[A]', '<a class="red">').replace('[/A]', '</a>');
    l[1067] = l[1067].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1094] = l[1094].replace('[A]', '<a href="#plugin">').replace('[/A]', '</a>');
    l[1095] = l[1095].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1133] = l[1133].replace('[A]',
        '<a href="http://en.wikipedia.org/wiki/Entropy" target="_blank" rel="noreferrer">').replace('[/A]', '</a>');
    l[1134] = l[1134].replace('[A]',
        '<a href="http://en.wikipedia.org/wiki/Public-key_cryptography" target="_blank" rel="noreferrer">').replace('[/A]',
        '</a>');
    l[1148] = l[1148].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[6978] = l[6978].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1151] = l[1151].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[731] = l[731].replace('[A]', '<a href="#terms">').replace('[/A]', '</a>');
    if (lang === 'en') {
        l[965] = 'Legal & policies';
    }
    l[1159] = l[1159].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1171] = l[1171].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1185] = l[1185].replace('[X]', '<strong>MEGA.crx</strong>');
    l[1212] = l[1212].replace('[A]', '<a href="#sdk" class="red">').replace('[/A]', '</a>');
    l[1274] = l[1274].replace('[A]', '<a href="#takedown">').replace('[/A]', '</a>');
    l[1275] = l[1275].replace('[A]', '<a href="#copyright">').replace('[/A]', '</a>');
    l[1201] = l[1201].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1208] = l[1208].replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[1915] = l[1915].replace('[A]',
        '<a class="red" href="https://chrome.google.com/webstore/detail/mega/bigefpfhnfcobdlfbedofhhaibnlghod" target="_blank" rel="noreferrer">')
            .replace('[/A]', '</a>');
    l[1936] = l[1936].replace('[A]', '<a href="#backup">').replace('[/A]', '</a>');
    l[1942] = l[1942].replace('[A]', '<a href="#backup">').replace('[/A]', '</a>');
    l[1943] = l[1943].replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>');
    l[1948] = l[1948].replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>');
    l[1957] = l[1957].replace('[A]', '<a href="#recovery">').replace('[/A]', '</a>');
    l[1965] = l[1965].replace('[A]', '<a href="#recovery">').replace('[/A]', '</a>');
    l[1982] = l[1982].replace('[A]', '<font style="color:#D21F00;">').replace('[/A]', '</font>');
    l[1993] = l[1993].replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[1371] = l[1371].replace('2014', '2015');
    l[122] = l[122].replace('five or six hours', '<span class="red">five or six hours</span>');
    l[231] = l[231].replace('No thanks, I\'ll wait', 'I\'ll wait');

    l['year'] = new Date().getFullYear();
    date_months = [
        l[408], l[409], l[410], l[411], l[412], l[413],
        l[414], l[415], l[416], l[417], l[418], l[419]
    ].map(escapeHTML);
}

function showmoney(number) {
    number = number.toString();
    var dollars = number.split('.')[0],
        cents = (number.split('.')[1] || '') + '00';
    dollars = dollars.split('').reverse().join('')
        .replace(/(\d{3}(?!$))/g, '$1,')
        .split('').reverse().join('');
    return dollars + '.' + cents.slice(0, 2);
}

function getHeight() {
    var myHeight = 0;
    if (typeof(window.innerWidth) === 'number') {
        myHeight = window.innerHeight;
    }
    else if (document.documentElement
            && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
        myHeight = document.documentElement.clientHeight;
    }
    else if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
        myHeight = document.body.clientHeight;
    }
    return myHeight;
}

function divscroll(el) {
    document.getElementById(el).scrollIntoView();
    $('body').scrollLeft(0);
    $('html').scrollTop(0);
    if (page === 'start') {
        start_menu(el);
    }
}

function removeHash() {
    var scrollV, scrollH, loc = window.location;

    // Prevent scrolling by storing the page's current scroll offset
    scrollV = document.body.scrollTop;
    scrollH = document.body.scrollLeft;
    loc.hash = "";

    // Restore the scroll offset, should be flicker free
    document.body.scrollTop = scrollV;
    document.body.scrollLeft = scrollH;
}

function browserdetails(useragent) {

    useragent = useragent || navigator.userAgent;
    useragent = (' ' + useragent).toLowerCase();

    var os = false;
    var browser = false;
    var icon = '';
    var name = '';
    var nameTrans = '';

    if (useragent.indexOf('android') > 0) {
        os = 'Android';
    }
    else if (useragent.indexOf('windows') > 0) {
        os = 'Windows';
    }
    else if (useragent.indexOf('iphone') > 0) {
        os = 'iPhone';
    }
    else if (useragent.indexOf('imega') > 0) {
        os = 'iPhone';
    }
    else if (useragent.indexOf('ipad') > 0) {
        os = 'iPad';
    }
    else if (useragent.indexOf('mac') > 0) {
        os = 'Apple';
    }
    else if (useragent.indexOf('linux') > 0) {
        os = 'Linux';
    }
    else if (useragent.indexOf('linux') > 0) {
        os = 'MEGAsync';
    }
    else if (useragent.indexOf('blackberry') > 0) {
        os = 'Blackberry';
    }
    if (useragent.indexOf('windows nt 1') > 0 && useragent.indexOf('edge/') > 0) {
        browser = 'Spartan';
    }
    else if (useragent.indexOf('opera') > 0 || useragent.indexOf(' opr/') > 0) {
        browser = 'Opera';
    }
    else if (useragent.indexOf(' dragon/') > 0) {
        icon = 'dragon.png';
        browser = 'Comodo Dragon';
    }
    else if (useragent.indexOf('vivaldi') > 0) {
        browser = 'Vivaldi';
    }
    else if (useragent.indexOf('maxthon') > 0) {
        browser = 'Maxthon';
    }
    else if (useragent.indexOf('chrome') > 0) {
        browser = 'Chrome';
    }
    else if (useragent.indexOf('safari') > 0) {
        browser = 'Safari';
    }
    else if (useragent.indexOf('palemoon') > 0) {
        browser = 'Palemoon';
    }
    else if (useragent.indexOf('firefox') > 0) {
        browser = 'Firefox';
    }
    else if (useragent.indexOf('thunderbird') > 0) {
        browser = 'Thunderbird';
    }
    else if (useragent.indexOf('megasync') > 0) {
        browser = 'MEGAsync';
    }
    else if (useragent.indexOf('msie') > 0
            || "ActiveXObject" in window) {
        browser = 'Internet Explorer';
    }

    // Translate "%1 on %2" to "Chrome on Windows"
    if ((os) && (browser)) {
        name = browser + ' on ' + os;
        nameTrans = String(l[7684]).replace('%1', browser).replace('%2', os);
    }
    else if (os) {
        name = os;
        icon = os.toLowerCase() + '.png';
    }
    else if (browser) {
        name = browser;
    }
    else {
        name = 'Unknown';
        icon = 'unknown.png';
    }
    if (!icon && browser) {
        if (browser === 'Internet Explorer' || browser === 'Spartan') {
            icon = 'ie.png';
        }
        else {
            icon = browser.toLowerCase() + '.png';
        }
    }

    var browserDetails = {};
    browserDetails.name = name;
    browserDetails.nameTrans = nameTrans || name;
    browserDetails.icon = icon;
    browserDetails.os = os || '';
    browserDetails.browser = browser;

    // Determine if the OS is 64bit
    browserDetails.is64bit = /\b(WOW64|x86_64|Win64|intel mac os x 10.(9|\d{2,}))/i.test(useragent);

    // Determine if using a browser extension
    browserDetails.isExtension = (useragent.indexOf('megext') > -1) ? true : false;

    return browserDetails;
}

function countrydetails(isocode) {
    var cdetails = {
        name: isocountries[isocode],
        icon: isocode.toLowerCase() + '.gif'
    };
    return cdetails;
}

function time2date(unixtime, ignoretime) {
    var MyDate = new Date(unixtime * 1000 || 0);
    var MyDateString =
        MyDate.getFullYear() + '-'
        + ('0' + (MyDate.getMonth() + 1)).slice(-2) + '-'
        + ('0' + MyDate.getDate()).slice(-2);
    if (!ignoretime) {
        MyDateString += ' ' + ('0' + MyDate.getHours()).slice(-2) + ':'
            + ('0' + MyDate.getMinutes()).slice(-2);
    }
    return MyDateString;
}

// in case we need to run functions.js in a standalone (non secureboot.js) environment, we need to handle this case:
if (typeof(l) === 'undefined') {
    l = [];
}

var date_months = []

function acc_time2date(unixtime) {
    var MyDate = new Date(unixtime * 1000);
    var th = 'th';
    if ((parseInt(MyDate.getDate()) === 11) || (parseInt(MyDate.getDate()) === 12)) {}
    else if (('' + MyDate.getDate()).slice(-1) === '1') {
        th = 'st';
    }
    else if (('' + MyDate.getDate()).slice(-1) === '2') {
        th = 'nd';
    }
    else if (('' + MyDate.getDate()).slice(-1) === '3') {
        th = 'rd';
    }
    if (lang !== 'en') {
        th = ',';
    }
    return date_months[MyDate.getMonth()] + ' ' + MyDate.getDate() + th + ' ' + MyDate.getFullYear();
}

function time2last(timestamp) {
    var sec = (new Date().getTime() / 1000) - timestamp;
    if (sec < 4) {
        return l[880];
    }
    else if (sec < 59) {
        return l[873].replace('[X]', Math.ceil(sec));
    }
    else if (sec < 90) {
        return l[874];
    }
    else if (sec < 3540) {
        return l[875].replace('[X]', Math.ceil(sec / 60));
    }
    else if (sec < 4500) {
        return l[876];
    }
    else if (sec < 82000) {
        return l[877].replace('[X]', Math.ceil(sec / 3600));
    }
    else if (sec < 110000) {
        return l[878];
    }
    else {
        return l[879].replace('[X]', Math.ceil(sec / 86400));
    }
}

function unixtime() {
    return (new Date().getTime() / 1000);
}

function uplpad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

function secondsToTime(secs) {
    if (isNaN(secs)) {
        return '--:--:--';
    }
    if (secs < 0) {
        return '';
    }

    var hours = uplpad(Math.floor(secs / (60 * 60)), 2);
    var divisor_for_minutes = secs % (60 * 60);
    var minutes = uplpad(Math.floor(divisor_for_minutes / 60), 2);
    var divisor_for_seconds = divisor_for_minutes % 60;
    var seconds = uplpad(Math.floor(divisor_for_seconds), 2);
    var returnvar = hours + ':' + minutes + ':' + seconds;
    return returnvar;
}

function htmlentities(value) {
    if (!value) {
        return '';
    }
    return $('<div/>').text(value).html();
}

function bytesToSize(bytes, precision) {
    if (!bytes) {
        return '0';
    }

    var s_b = 'B';
    var s_kb = 'KB';
    var s_mb = 'MB';
    var s_gb = 'GB';
    var s_tb = 'TB';

    if (lang === 'fr') {
        s_b = 'O';
        s_kb = 'Ko';
        s_mb = 'Mo';
        s_gb = 'Go';
        s_tb = 'To';
    }

    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;
    if (bytes > 1024 * 1024 * 1024) {
        precision = 2;
    }
    else if (bytes > 1024 * 1024) {
        precision = 1;
    }
    if ((bytes >= 0) && (bytes < kilobyte)) {
        return parseInt(bytes) + ' ' + s_b;
    }
    else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed(precision) + ' ' + s_kb;
    }
    else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed(precision) + ' ' + s_mb;
    }
    else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed(precision) + ' ' + s_gb;
    }
    else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed(precision) + ' ' + s_tb;
    }
    else {
        return parseInt(bytes) + ' ' + s_b;
    }
}

function checkPassword(strPassword) {
    var m_strUpperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var m_strLowerCase = "abcdefghijklmnopqrstuvwxyz";
    var m_strNumber = "0123456789";
    var m_strCharacters = "!@#$%^&*?_~";
    var nScore = 0;
    nScore += countDif(strPassword) * 2;
    var extra = countDif(strPassword) * strPassword.length / 3;
    if (extra > 25) {
        extra = 25;
    }
    nScore += extra;
    var nUpperCount = countContain(strPassword, m_strUpperCase);
    var nLowerCount = countContain(strPassword, m_strLowerCase);
    var nLowerUpperCount = nUpperCount + nLowerCount;
    if (nUpperCount === 0 && nLowerCount !== 0) {
        nScore += 10;
    }
    else if (nUpperCount !== 0 && nLowerCount !== 0) {
        nScore += 10;
    }
    var nNumberCount = countContain(strPassword, m_strNumber);
    if (nNumberCount === 1) {
        nScore += 10;
    }
    if (nNumberCount >= 3) {
        nScore += 15;
    }
    var nCharacterCount = countContain(strPassword, m_strCharacters);
    if (nCharacterCount === 1) {
        nScore += 10;
    }
    if (nCharacterCount > 1) {
        nScore += 10;
    }
    if (nNumberCount !== 0 && nLowerUpperCount !== 0) {
        nScore += 2;
    }
    if (nNumberCount !== 0 && nLowerUpperCount !== 0 && nCharacterCount !== 0) {
        nScore += 3;
    }
    if (nNumberCount !== 0 && nUpperCount !== 0 && nLowerCount !== 0 && nCharacterCount !== 0) {
        nScore += 5;
    }
    return nScore;
}

function showNonActivatedAccountDialog(log) {
    if (log) {
        megaAnalytics.log("pro", "showNonActivatedAccountDialog");
    }

    var $dialog = $('.top-warning-popup');
    $dialog.addClass('not-activated');
    $('.warning-green-icon', $dialog).remove();
    $('.fm-notifications-bottom', $dialog).hide();
    $('.warning-popup-body', $dialog)
        .unbind('click')
        .empty()
        .append($("<div class='warning-gray-icon mailbox-icon'></div>"))
        .append(l[5847]); //TODO: l[]
}

/**
 * Shows a dialog with a message that the user is over quota
 */
function showOverQuotaDialog() {

    // Show the dialog
    var $dialog = $('.top-warning-popup');
    $dialog.addClass('active');

    // Unhide the warning icon and show the button
    $('.warning-popup-icon').removeClass('hidden');
    $('.fm-notifications-bottom', $dialog).show();

    // Add a click event on the warning icon to hide and show the dialog
    $('.warning-icon-area').unbind('click');
    $('.warning-icon-area').click(function() {
        if ($dialog.hasClass('active')) {
            $dialog.removeClass('active');
        }
        else {
            $dialog.addClass('active');
        }
    });

    // Change contents of dialog text
    $('.warning-green-icon', $dialog).remove();
    $('.warning-popup-body', $dialog).unbind('click').html(
        '<div class="warning-header">' + l[1010] + '</div>' + l[5929]
        + "<p>" + l[5931].replace("[A]", "<a href='#fm/account' style='text-decoration: underline'>").replace("[/A]", "</a>") + "</p>"
    );

    // Set button text to 'Upgrade Account'
    $('.warning-button span').text(l[5549]);

    // Redirect to Pro signup page on button click
    $('.warning-button').click(function() {
        document.location.hash = 'pro';
    });
}

function countDif(strPassword) {
    var chararr = [];
    var nCount = 0;
    for (i = 0; i < strPassword.length; i++) {
        if (!chararr[strPassword.charAt(i)]) {
            chararr[strPassword.charAt(i)] = true;
            nCount++;
        }
    }
    return nCount;
}

function countContain(strPassword, strCheck) {
    var nCount = 0;
    for (i = 0; i < strPassword.length; i++) {
        if (strCheck.indexOf(strPassword.charAt(i)) > -1) {
            nCount++;
        }
    }
    return nCount;
}

function logincheckboxCheck(ch_id) {
    var ch_div = ch_id + "_div";
    if (document.getElementById(ch_id).checked) {
        document.getElementById(ch_div).className = "checkboxOn";
    }
    else {
        document.getElementById(ch_div).className = "checkboxOff";
    }
}

function makeid(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < len; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function checkMail(email) {
    email = email.replace(/\+/g, '');
    var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (filter.test(email)) {
        return false;
    }
    else {
        return true;
    }
}

/**
 * Helper function for creating alias of a method w/ specific context
 *
 * @param context
 * @param fn
 * @returns {aliasClosure}
 */
function funcAlias(context, fn) {
    return function aliasClosure() {
        return fn.apply(context, arguments);
    };
}

/**
 * Adds on, bind, unbind, one and trigger methods to a specific class's prototype.
 *
 * @param kls class on which prototype this method should add the on, bind, unbind, etc methods
 */
function makeObservable(kls) {
    var aliases = ['on', 'bind', 'unbind', 'one', 'trigger', 'rebind'];

    $.each(aliases, function(k, v) {
        if (kls.prototype) {
            kls.prototype[v] = function() {
                return $(this)[v].apply($(this), toArray(arguments));
            }
        }
        else {
            kls[v] = function() {
                return $(this)[v].apply($(this), toArray(arguments));
            }
        }
    });
}

/**
 * Instantiates an enum-like list on the provided target object
 */
function makeEnum(aEnum, aPrefix, aTarget) {
    aTarget = aTarget || {};

    var len = aEnum.length;
    while (len--) {
        Object.defineProperty(aTarget,
            (aPrefix || '') + String(aEnum[len]).toUpperCase(), {
                value: 1 << len,
                enumerable: true
            });
    }
    return aTarget;
}

/**
 * Adds simple .setMeta and .getMeta functions, which can be used to store some meta information on the fly.
 * Also triggers `onMetaChange` events (only if the `kls` have a `trigger` method !)
 *
 * @param kls {Class} on which prototype's this method should add the setMeta and getMeta
 */
function makeMetaAware(kls) {
    /**
     * Store meta data
     *
     * @param prefix string
     * @param namespace string
     * @param k string
     * @param val {*}
     */
    kls.prototype.setMeta = function(prefix, namespace, k, val) {
        var self = this;

        if (self["_" + prefix] === undefined) {
            self["_" + prefix] = {};
        }
        if (self["_" + prefix][namespace] === undefined) {
            self["_" + prefix][namespace] = {};
        }
        self["_" + prefix][namespace][k] = val;

        if (self.trigger) {
            self.trigger("onMetaChange", prefix, namespace, k, val);
        }
    };

    /**
     * Clear/delete meta data
     *
     * @param prefix string  optional
     * @param [namespace] string  optional
     * @param [k] string optional
     */
    kls.prototype.clearMeta = function(prefix, namespace, k) {
        var self = this;

        if (prefix && !namespace && !k) {
            delete self["_" + prefix];
        }
        else if (prefix && namespace && !k) {
            delete self["_" + prefix][namespace];
        }
        else if (prefix && namespace && k) {
            delete self["_" + prefix][namespace][k];
        }

        if (self.trigger) {
            self.trigger("onMetaChange", prefix, namespace, k);
        }
    };

    /**
     * Retrieve meta data
     *
     * @param prefix {string}
     * @param namespace {string} optional
     * @param k {string} optional
     * @param default_value {*} optional
     * @returns {*}
     */
    kls.prototype.getMeta = function(prefix, namespace, k, default_value) {
        var self = this;

        namespace = namespace || undefined; /* optional */
        k = k || undefined; /* optional */
        default_value = default_value || undefined; /* optional */

        // support for calling only with 2 args.
        if (k === undefined) {
            if (self["_" + prefix] === undefined) {
                return default_value;
            }
            else {
                return self["_" + prefix][namespace] || default_value;
            }
        }
        else {
            // all args

            if (self["_" + prefix] === undefined) {
                return default_value;
            }
            else if (self["_" + prefix][namespace] === undefined) {
                return default_value;
            }
            else {
                return self["_" + prefix][namespace][k] || default_value;
            }
        }
    };
}

/**
 * Simple method for generating unique event name with a .suffix that is a hash of the passed 3-n arguments
 * Main purpose is to be used with jQuery.bind and jQuery.unbind.
 *
 * @param eventName {string} event name
 * @param name {string} name of the handler (e.g. .suffix)
 * @returns {string} e.g. $eventName.$name_$ShortHashOfTheAdditionalArguments
 */
function generateEventSuffixFromArguments(eventName, name) {
    var args = Array.prototype.splice.call(arguments, 2);
    var result = "";
    $.each(args, function(k, v) {
        result += v;
    });

    return eventName + "." + name + "_" + ("" + fastHashFunction(result)).replace("-", "_");
}

/**
 * This is a placeholder, which will be used anywhere in our code where we need a simple and FAST hash function.
 * Later on, we can change the implementation (to use md5 or murmur) by just changing the function body of this
 * function.
 * @param {String}
 */
function fastHashFunction(val) {
    return MurmurHash3(val, 0x4ef5391a).toString();
}

/**
 * @see http://stackoverflow.com/q/7616461/940217
 * @return {number}
 */
function simpleStringHashCode(str) {
    assert(str, "Missing str passed to simpleStringHashCode");

    if (Array.prototype.reduce) {
        return str.split("").reduce(function(a, b) {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a
        }, 0);
    }
    var hash = 0;
    if (str.length === 0) {
        return hash;
    }
    for (var i = 0; i < str.length; i++) {
        var character = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Creates a promise, which will fail if the validateFunction() don't return true in a timely manner (e.g. < timeout).
 *
 * @param validateFunction {Function}
 * @param tick {int}
 * @param timeout {int}
 * @param [resolveRejectArgs] {(Array|*)} args that will be used to call back .resolve/.reject
 * @param [waitForPromise] {(MegaPromise|$.Deferred)} Before starting the timer, we will wait for this promise to be rej/res first.
 * @returns {Deferred}
 */
function createTimeoutPromise(validateFunction, tick, timeout,
                              resolveRejectArgs, waitForPromise) {
    var $promise = new MegaPromise();
    resolveRejectArgs = resolveRejectArgs || [];
    if (!$.isArray(resolveRejectArgs)) {
        resolveRejectArgs = [resolveRejectArgs]
    }

    $promise.verify = function() {
        if (validateFunction()) {
            if (window.d) {
                console.debug("Resolving timeout promise",
                    timeout, "ms", "at", (new Date()),
                    validateFunction, resolveRejectArgs);
            }
            $promise.resolve.apply($promise, resolveRejectArgs);
        }
    };

    var startTimerChecks = function() {
        var tickInterval = setInterval(function() {
            $promise.verify();
        }, tick);

        var timeoutTimer = setTimeout(function() {
            if (validateFunction()) {
                if (window.d) {
                    console.debug("Resolving timeout promise",
                        timeout, "ms", "at", (new Date()),
                        validateFunction, resolveRejectArgs);
                }
                $promise.resolve.apply($promise, resolveRejectArgs);
            }
            else {
                console.error("Timed out after waiting",
                    timeout, "ms", "at", (new Date()),
                    validateFunction, resolveRejectArgs);
                $promise.reject.apply($promise, resolveRejectArgs);
            }
        }, timeout);

        // stop any running timers and timeouts
        $promise.always(function() {
            clearInterval(tickInterval);
            clearTimeout(timeoutTimer);
        });

        $promise.verify();
    };

    if (!waitForPromise || !waitForPromise.done) {
        startTimerChecks();
    }
    else {
        waitForPromise.always(function() {
            startTimerChecks();
        });
    }

    return $promise;
}

/**
 * Simple .toArray method to be used to convert `arguments` to a normal JavaScript Array
 *
 * @param val {Arguments}
 * @returns {Array}
 */
function toArray(val) {
    return Array.prototype.slice.call(val, val);
}

/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * (c) 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
(function(Date, undefined) {
    var origParse = Date.parse,
        numericKeys = [1, 4, 5, 6, 7, 10, 11];
    Date.parse = function(date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that's what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 +    10 tzHH    11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by "undefined" values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1],
                    struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));

/**
 * @module assert
 *
 * Assertion helper module.
 *
 * @example
 * function lastElement(array) {
 *     assert(array.length > 0, "empty array in lastElement");
 *     return array[array.length - 1];
 * }
 */
/**
 * Assertion exception.
 * @param message
 *     Message for exception on failure.
 * @constructor
 */
function AssertionFailed(message) {
    this.message = message;
}
AssertionFailed.prototype = Object.create(Error.prototype);
AssertionFailed.prototype.name = 'AssertionFailed';

/**
 * Assert a given test condition.
 *
 * Throws an AssertionFailed exception with a given message, in case the condition is false.
 * The message is assembled by the args following 'test', similar to console.log()
 *
 * @param test
 *     Test statement.
 */
function assert(test) {
    if (test) {
        return;
    }
    //assemble message from parameters
    var message = '';
    var last = arguments.length - 1;
    for (var i = 1; i <= last; i++) {
        message += arguments[i];
        if (i < last) {
            message += ' ';
        }
    }
    if (MegaLogger && MegaLogger.rootLogger) {
        MegaLogger.rootLogger.error("assertion failed: ", message);
    }
    else if (window.d) {
        console.error(message);
    }

    if (localStorage.stopOnAssertFail) {
        debugger;
    }

    throw new AssertionFailed(message);
}


/**
 * Assert that a user handle is potentially valid (e. g. not an email address).
 *
 * @param userHandle {string}
 *     The user handle to check.
 * @throws
 *     Throws an exception on something that does not seem to be a user handle.
 */
var assertUserHandle = function(userHandle) {
    assert(base64urldecode(userHandle).length === 8,
       'This seems not to be a user handle: ' + userHandle);
};


/**
 * Pad/prepend `val` with "0" (zeros) until the length is === `length`
 *
 * @param val {String} value to add "0" to
 * @param len {Number} expected length
 * @returns {String}
 */
function addZeroIfLenLessThen(val, len) {
    if (val.toString().length < len) {
        for (var i = val.toString().length; i < len; i++) {
            val = "0" + val;
        }
    }
    return val;
}

function NOW() {
    return Date.now();
}

/**
 *  Global function to help debugging
 */
function DEBUG2() {
    if (typeof(d) !== "undefined" && d) {
        console.warn.apply(console, arguments)
    }
}

function ERRDEBUG() {
    if (typeof(d) !== "undefined" && d) {
        console.error.apply(console, arguments)
    }
}

function DEBUG() {
    if (typeof(d) !== "undefined" && d) {
        (console.debug || console.log).apply(console, arguments)
    }
}

function ASSERT(what, msg, udata) {
    if (!what) {
        var af = new Error('failed assertion; ' + msg);
        if (udata) {
            af.udata = udata;
        }
        Soon(function() {
            throw af;
        });
        if (console.assert) {
            console.assert(what, msg);
        }
        else {
            console.error('FAILED ASSERTION', msg);
        }
    }
    return !!what;
}

function srvlog(msg, data, silent) {
    if (data && !(data instanceof Error)) {
        data = {
            udata: data
        };
    }
    if (!silent && d) {
        console.error(msg, data);
    }
    if (!d || onBetaW) {
        window.onerror(msg, '', data ? 1 : -1, 0, data || null);
    }
}

function oDestroy(obj) {
    if (window.d) {
        ASSERT(Object.isFrozen(obj) === false, 'Object already frozen...');
    }

    Object.keys(obj).forEach(function(memb) {
        if (obj.hasOwnProperty(memb)) {
            delete obj[memb];
        }
    });
    if (!oIsFrozen(obj)) {
        Object.defineProperty(obj, ":$:frozen:", {
            value: String(new Date()),
            writable: false
        });
    }

    if (window.d) {
        Object.freeze(obj);
    }
}

function oIsFrozen(obj) {
    return obj && typeof obj === 'object' && obj.hasOwnProperty(":$:frozen:");
}

/**
 *  Return a default callback for error handlign
 */
function dlError(text) {
    return function(e) {
        console.log(text + ' ' + e);
        alert(text + ' ' + e);
    };
}

/**
 *  Remove an element from an *array*
 */
function removeValue(array, value, can_fail) {
    var idx = array.indexOf(value);
    if (d) {
        if (!(can_fail || idx !== -1)) {
            console.warn('Unable to Remove Value ' + value, value);
        }
    }
    if (idx !== -1) {
        array.splice(idx, 1);
    }
    return idx !== -1;
}

function setTransferStatus(dl, status, ethrow, lock) {
    var id = dl && dlmanager.getGID(dl);
    var text = '' + status;
    if (text.length > 44) {
        text = text.substr(0, 42) + '...';
    }
    $('.transfer-table #' + id + ' td:eq(5)').text(text);
    if (lock) {
        $('.transfer-table #' + id).attr('id', 'LOCKed_' + id);
    }
    if (d) {
        console.error(status);
    }
    if (ethrow) {
        throw status;
    }
}

function dlFatalError(dl, error, ethrow) {
    var m = 'This issue should be resolved ';
    if (navigator.webkitGetUserMedia) {
        m += 'exiting from Incognito mode.';
        msgDialog('warninga', l[1676], m, error);
    }
    else if (navigator.msSaveOrOpenBlob) {
        Later(browserDialog);
        m = l[1933];
        msgDialog('warninga', l[1676], m, error);
    }
    else if (dlMethod === FlashIO) {
        Later(browserDialog);
        m = l[1308];
        msgDialog('warninga', l[1676], m, error);
    }
    else {
        Later(firefoxDialog);
    }
    setTransferStatus(dl, error, ethrow, true);
    dlmanager.abort(dl);
}

/**
 * Original: http://stackoverflow.com/questions/7317299/regex-matching-list-of-emoticons-of-various-type
 *
 * @param text
 * @returns {XML|string|void}
 * @constructor
 */
function RegExpEscape(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function unixtimeToTimeString(timestamp) {
    var date = new Date(timestamp * 1000);
    return addZeroIfLenLessThen(date.getHours(), 2)
        + ":" + addZeroIfLenLessThen(date.getMinutes(), 2)
        + "." + addZeroIfLenLessThen(date.getSeconds(), 2)
}

/**
 * Used in the callLoggerWrapper to generate dynamic colors depending on the textPrefix
 *
 * copyrights: http://stackoverflow.com/questions/9600295/automatically-change-text-color-to-assure-readability
 *
 * @param hexTripletColor
 * @returns {*}
 */
function invertColor(hexTripletColor) {
    var color = hexTripletColor;
    color = color.substring(1);           // remove #
    color = parseInt(color, 16);          // convert to integer
    color = 0xFFFFFF ^ color;             // invert three bytes
    color = color.toString(16);           // convert to hex
    color = ("000000" + color).slice(-6); // pad with leading zeros
    color = "#" + color;                  // prepend #
    return color;
}

/**
 * Simple wrapper function that will log all calls of `fnName`.
 * This function is intended to be used for dev/debugging/testing purposes only.
 *
 * @param ctx
 * @param fnName
 * @param loggerFn
 */
function callLoggerWrapper(ctx, fnName, loggerFn, textPrefix, parentLogger) {
    if (!window.d) {
        return;
    }

    var origFn = ctx[fnName];
    textPrefix = textPrefix || "missing-prefix";

    var logger = MegaLogger.getLogger(textPrefix + "[" + fnName + "]", {}, parentLogger);
    var logFnName = loggerFn === console.error ? "error" : "debug";

    if (ctx[fnName].haveCallLogger) { // recursion
        return;
    }
    ctx[fnName] = function() {
        //loggerFn.apply(console, [prefix1, prefix2, "Called: ", fnName, toArray(arguments)]);
        logger[logFnName].apply(logger, ["(calling) arguments: "].concat(toArray(arguments)));

        var res = origFn.apply(this, toArray(arguments));
        //loggerFn.apply(console, [prefix1, prefix2, "Got result: ", fnName, toArray(arguments), res]);
        logger[logFnName].apply(logger, ["(end call) arguments: "].concat(toArray(arguments)).concat(["returned: ", res]));

        return res;
    };
    ctx[fnName].haveCallLogger = true; // recursion
}

/**
 * Simple Object instance call log helper
 * This function is intended to be used for dev/debugging/testing purposes only.
 *
 *
 * WARNING: This function will create tons of references in the window.callLoggerObjects & also may flood your console.
 *
 * @param ctx
 * @param [loggerFn] {Function}
 * @param [recursive] {boolean}
 */
function logAllCallsOnObject(ctx, loggerFn, recursive, textPrefix, parentLogger) {
    if (!window.d) {
        return;
    }
    loggerFn = loggerFn || console.debug;

    if (typeof(parentLogger) === "undefined") {
        var logger = new MegaLogger(textPrefix);
    }
    if (!window.callLoggerObjects) {
        window.callLoggerObjects = [];
    }

    $.each(ctx, function(k, v) {
        if (typeof(v) === "function") {
            callLoggerWrapper(ctx, k, loggerFn, textPrefix, parentLogger);
        }
        else if (typeof(v) === "object"
                && !$.isArray(v) && v !== null && recursive && !$.inArray(window.callLoggerObjects)) {
            window.callLoggerObjects.push(v);
            logAllCallsOnObject(v, loggerFn, recursive, textPrefix + ":" + k, parentLogger);
        }
    });
}

/**
 * Get an array with unique values
 * @param {Array} arr Array
 */
function array_unique(arr) {
    return arr.reduce(function(out, value) {
        if (out.indexOf(value) < 0) {
            out.push(value);
        }
        return out;
    }, []);
}

/**
 * Get a random value from an array
 * @param {Array} arr Array
 */
function array_random(arr) {
    return arr[rand(arr.length)];
}

/**
 * Simple method that will convert Mega user ids to base32 strings (that should be used when doing XMPP auth)
 *
 * @param handle {string} mega user id
 * @returns {string} base32 formatted user id to be used when doing xmpp auth
 */
function megaUserIdEncodeForXmpp(handle) {
    var s = base64urldecode(handle);
    return base32.encode(s);
}

/**
 * Simple method that will convert base32 strings -> Mega user ids
 *
 * @param handle {string} mega user id
 * @returns {string} base32 formatted user id to be used when doing xmpp auth
 */
function megaJidToUserId(jid) {
    var s = base32.decode(jid.split("@")[0]);
    return base64urlencode(s).replace(/=/g, "");
}

/**
 * Implementation of a string encryption/decryption.
 */
var stringcrypt = (function() {
    "use strict";

    /**
     * @description
     * Implementation of a string encryption/decryption.</p>
     */
    var ns = {};

    /**
     * Encrypts clear text data to an authenticated ciphertext, armoured with
     * encryption mode indicator and IV.
     *
     * @param plain {string}
     *     Plain data block as (unicode) string.
     * @param key {string}
     *     Encryption key as byte string.
     * @returns {string}
     *     Encrypted data block as byte string, incorporating mode, nonce and MAC.
     */
    ns.stringEncrypter = function(plain, key) {
        var mode = tlvstore.BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16;
        var plainBytes = unescape(encodeURIComponent(plain));
        var cipher = tlvstore.blockEncrypt(plainBytes, key, mode);
        return cipher;
    };

    /**
     * Decrypts an authenticated cipher text armoured with a mode indicator and IV
     * to clear text data.
     *
     * @param cipher {string}
     *     Encrypted data block as byte string, incorporating mode, nonce and MAC.
     * @param key {string}
     *     Encryption key as byte string.
     * @returns {string}
     *     Clear text as (unicode) string.
     */
    ns.stringDecrypter = function(cipher, key) {
        var plain = tlvstore.blockDecrypt(cipher, key);
        return decodeURIComponent(escape(plain));
    };

    /**
     * Generates a new AES-128 key.
     *
     * @returns {string}
     *     Symmetric key as byte string.
     */
    ns.newKey = function() {
        var keyBytes = new Uint8Array(16);
        asmCrypto.getRandomValues(keyBytes);
        return asmCrypto.bytes_to_string(keyBytes);
    };

    return ns;
})();

/**
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 *
 * @author <a href="mailto:gary.court.gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/murmurhash-js
 * @author <a href="mailto:aappleby.gmail.com">Austin Appleby</a>
 * @see http://sites.google.com/site/murmurhash/
 *
 * @param {string} key ASCII only
 * @param {number} seed Positive integer only
 * @return {number} 32-bit positive integer hash
 */
function MurmurHash3(key, seed) {
    var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

    remainder = key.length & 3; // key.length % 4
    bytes = key.length - remainder;
    h1 = seed || 0xe6546b64;
    c1 = 0xcc9e2d51;
    c2 = 0x1b873593;
    i = 0;

    while (i < bytes) {
        k1 =
            ((key.charCodeAt(i) & 0xff)) |
            ((key.charCodeAt(++i) & 0xff) << 8) |
            ((key.charCodeAt(++i) & 0xff) << 16) |
            ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;

        k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
        h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
    }

    k1 = 0;

    switch (remainder) {
        case 3:
            k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2:
            k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= (key.charCodeAt(i) & 0xff);

            k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
            h1 ^= k1;
    }

    h1 ^= key.length;

    h1 ^= h1 >>> 16;
    h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= h1 >>> 13;
    h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}

/**
 *  Create a pool of workers, it returns a Queue object
 *  so it can be called many times and it'd be throttled
 *  by the queue
 */
function CreateWorkers(url, message, size) {
    size = size || 4
    var worker = [],
        instances = [];

    function handler(id) {
        return function(e) {
            message(this.context, e, function(r) {
                worker[id].busy = false; /* release worker */
                instances[id](r);
            });
        }
    }

    function create(i) {
        var w;

        try {
            w = new Worker(url);
        }
        catch (e) {
            msgDialog('warninga', '' + url, '' + e, location.hostname);
            throw e;
        }

        w.id = i;
        w.busy = false;
        w.postMessage = w.webkitPostMessage || w.postMessage;
        w.onmessage = handler(i);
        return w;
    }

    for (var i = 0; i < size; i++) {
        worker.push(null);
    }

    return new MegaQueue(function(task, done) {
        for (var i = 0; i < size; i++) {
            if (worker[i] === null) {
                worker[i] = create(i);
            }
            if (!worker[i].busy) {
                break;
            }
        }
        worker[i].busy = true;
        instances[i] = done;
        $.each(task, function(e, t) {
                if (e === 0) {
                    worker[i].context = t;
                }
                else if (t.constructor === Uint8Array && typeof MSBlobBuilder !== "function") {
                    worker[i].postMessage(t.buffer, [t.buffer]);
                }
                else {
                    worker[i].postMessage(t);
                }
            });
    }, size, url.split('/').pop().split('.').shift() + '-worker');
}

function mKeyDialog(ph, fl) {
    var promise = new MegaPromise();

    $('.new-download-buttons').addClass('hidden');
    $('.new-download-file-title').text(l[1199]);
    $('.new-download-file-icon').addClass(fileIcon({
        name: 'unknown.unknown'
    }));
    $('.fm-dialog.dlkey-dialog').removeClass('hidden');
    $('.fm-dialog-overlay').removeClass('hidden');
    $('body').addClass('overlayed');

    $('.fm-dialog.dlkey-dialog input').rebind('keydown', function(e) {
        $('.fm-dialog.dlkey-dialog .fm-dialog-new-folder-button').addClass('active');
        if (e.keyCode === 13) {
            $('.fm-dialog.dlkey-dialog .fm-dialog-new-folder-button').click();
        }
    });
    $('.fm-dialog.dlkey-dialog .fm-dialog-new-folder-button').rebind('click', function(e) {
        var key = $('.fm-dialog.dlkey-dialog input').val();

        if (key) {
            // Remove the ! from the key which is exported from the export dialog
            key = key.replace('!', '');
            promise.resolve(key);

            $('.fm-dialog.dlkey-dialog').addClass('hidden');
            $('.fm-dialog-overlay').addClass('hidden');
            document.location.hash = (fl ? '#F!' : '#!') + ph + '!' + key;
        }
        else {
            promise.reject();
        }
    });
    $('.fm-dialog.dlkey-dialog .fm-dialog-close').rebind('click', function(e) {
        $('.fm-dialog.dlkey-dialog').addClass('hidden');
        $('.fm-dialog-overlay').addClass('hidden');
        promise.reject();
    });

    return promise;
}

function dcTracer(ctr) {
    var name = ctr.name,
        proto = ctr.prototype;
    for (var fn in proto) {
        if (proto.hasOwnProperty(fn) && typeof proto[fn] === 'function') {
            console.log('Tracing ' + name + '.' + fn);
            proto[fn] = (function(fn, fc) {
                fc.dbg = function() {
                    try {
                        console.log('Entering ' + name + '.' + fn,
                            this, '~####~', Array.prototype.slice.call(arguments));
                        var r = fc.apply(this, arguments);
                        console.log('Leaving ' + name + '.' + fn, r);
                        return r;
                    }
                    catch (e) {
                        console.error(e);
                    }
                };
                return fc.dbg;
            })(fn, proto[fn]);
        }
    }
}

function mSpawnWorker(url, nw) {
    if (!(this instanceof mSpawnWorker)) {
        return new mSpawnWorker(url, nw);
    }

    this.jid = 1;
    this.jobs = {};
    this.nworkers = nw = nw || 4;
    this.wrk = new Array(nw);
    this.token = mRandomToken('mSpawnWorker.' + url.split(".")[0]);

    while (nw--) {
        if (!(this.wrk[nw] = this.add(url))) {
            throw new Error(this.token.split("$")[0] + ' Setup Error');
        }
    }
}
mSpawnWorker.prototype = {
    process: function mSW_Process(data, callback, onerror) {
        if (!Array.isArray(data)) {
            var err = new Error("'data' must be an array");
            if (onerror) {
                return onerror(err);
            }
            throw err;
        }
        if (this.unreliably) {
            return onerror(0xBADF);
        }
        var nw = this.nworkers,
            l = Math.ceil(data.length / nw);
        var id = mRandomToken("mSWJobID" + this.jid++),
            idx = 0;
        var job = {
            done: 0,
            data: [],
            callback: callback
        };

        while (nw--) {
            job.data.push(data.slice(idx, idx += l));
        }
        if (onerror) {
            job.onerror = onerror;
        }
        this.jobs[id] = job;
        this.postNext();
    },
    postNext: function mSW_PostNext() {
        if (this.busy()) {
            return;
        }
        for (var id in this.jobs) {
            var nw = this.nworkers;
            var job = this.jobs[id],
                data;

            while (nw--) {
                if (!this.wrk[nw].working) {
                    data = job.data.shift();
                    if (data) {
                        this.wrk[nw].working = !0;
                        this.wrk[nw].postMessage({
                            data: data,
                            debug: !!window.d,
                            u_sharekeys: u_sharekeys,
                            u_privk: u_privk,
                            u_handle: u_handle,
                            u_k: u_k,
                            jid: id
                        });

                        if (d && job.data.length === this.nworkers - 1) {
                            console.time(id);
                        }
                    }
                }
            }
        }
    },
    busy: function() {
        var nw = this.nworkers;
        while (nw-- && this.wrk[nw].working);
        return nw === -1;
    },
    add: function mSW_Add(url) {
        var self = this,
            wrk;

        try {
            wrk = new Worker(url);
        }
        catch (e) {
            console.error(e);
            if (!window[this.token]) {
                window[this.token] = true;
                msgDialog('warninga', l[16], "Unable to launch " + url + " worker.", e);
            }
            return false;
        }

        wrk.onerror = function mSW_OnError(err) {
            console.error(err);
            if (!(self && self.wrk)) {
                return;
            }
            Soon(function() {
                throw err.message || err;
            });
            self.unreliably = true;
            var nw = self.nworkers;
            while (nw--) {
                if (self.wrk[nw]) {
                    self.wrk[nw].terminate();
                }
            }
            for (var id in self.jobs) {
                var job = self.jobs[id];
                if (job.onerror) {
                    job.onerror(err);
                }
            }
            if (!window[self.token]) {
                window[self.token] = true;
                if (err.filename) {
                    msgDialog('warninga',
                        "Worker Exception: " + url, err.message, err.filename + ":" + err.lineno);
                }
            }
            delete self.wrk;
            delete self.jobs;
            self = undefined;
        };

        wrk.onmessage = function mSW_OnMessage(ev) {
            if (ev.data[0] === 'console') {
                if (d) {
                    var args = ev.data[1];
                    args.unshift(self.token);
                    console.log.apply(console, args);
                }
                return;
            }
            if (d) {
                console.log(self.token, ev.data);
            }

            wrk.working = false;
            if (!self.done(ev.data)) {
                this.onerror(0xBADF);
            }
        };

        if (d) {
            console.log(this.token, 'Starting...');
        }

        wrk.postMessage = wrk.postMessage || wrk.webkitPostMessage;

        return wrk;
    },
    done: function mSW_Done(reply) {
        var job = this.jobs[reply.jid];
        if (!ASSERT(job, 'Invalid worker reply.')) {
            return false;
        }

        if (!job.result) {
            job.result = reply.result;
        }
        else {
            $.extend(job.result, reply.result);
        }

        if (reply.newmissingkeys) {
            job.newmissingkeys = newmissingkeys = true;
            $.extend(missingkeys, reply.missingkeys);
        }
        if (reply.rsa2aes) {
            $.extend(rsa2aes, reply.rsa2aes);
        }
        if (reply.u_sharekeys) {
            $.extend(u_sharekeys, reply.u_sharekeys);
        }
        if (reply.rsasharekeys) {
            $.extend(rsasharekeys, reply.rsasharekeys);
        }

        Soon(this.postNext.bind(this));
        if (++job.done === this.nworkers) {
            if (d) {
                console.timeEnd(reply.jid);
            }

            delete this.jobs[reply.jid];
            job.callback(job.result, job);
        }

        return true;
    }
};

function mRandomToken(pfx) {
    return (pfx || '!') + '$' + (Math.random() * Date.now()).toString(36);
}

function str_mtrunc(str, len) {
    if (!len) {
        len = 35;
    }
    if (len > (str || '').length) {
        return str;
    }
    var p1 = Math.ceil(0.60 * len),
        p2 = Math.ceil(0.30 * len);
    return str.substr(0, p1) + '\u2026' + str.substr(-p2);
}

function setupTransferAnalysis() {
    if ($.mTransferAnalysis) {
        return;
    }

    var prev = {},
        tlen = {},
        time = {},
        chunks = {};
    $.mTransferAnalysis = setInterval(function() {
        if (uldl_hold) {
            prev = {};
        }
        else if ($.transferprogress) {
            var tp = $.transferprogress;

            for (var i in tp) {
                var q = (i[0] === 'u' ? ulQueue : dlQueue);
                if (!GlobalProgress[i] || GlobalProgress[i].paused
                        || tp[i][0] === tp[i][1] || q.isPaused() || q._qpaused[i]) {
                    delete prev[i];
                }
                else if (prev[i] && prev[i] === tp[i][0]) {
                    var p = tp[i],
                        t = i[0] === 'u' ? 'Upload' : 'Download',
                        r = '',
                        data = [];
                    var s = GlobalProgress[i].speed,
                        w = GlobalProgress[i].working || [];
                    var c = p[0] + '/' + p[1] + '-' + Math.floor(p[0] / p[1] * 100) + '%';
                    var u = w.map(function(c) {
                        var x = c.xhr || {};
                        return ['' + c, x.__failed, x.__timeout,
                            !!x.listener, x.__id, x.readyState > 1 && x.status];
                    });

                    if (d) {
                        console.warn(i + ' might be stuck, checking...', c, w.length, u);
                    }

                    if (w.length) {
                        var j = w.length;
                        while (j--) {
                            /**
                             * if there's a timer, no need to call on_error ourselves
                             * since the chunk will get restarted there by the xhr
                             */
                            var stuck = w[j].xhr && !w[j].xhr.__timeout;
                            if (stuck) {
                                var chunk_id = '' + w[j],
                                    n = u[j];

                                if (w[j].dl && w[j].dl.lasterror) {
                                    r = '[DLERR' + w[j].dl.lasterror + ']';
                                }
                                else if (w[j].srverr) {
                                    r = '[SRVERR' + (w[j].srverr - 1) + ']';
                                }

                                try {
                                    w[j].on_error(0, {}, 'Stuck');
                                }
                                catch (e) {
                                    n.push(e.message);
                                }

                                if (!chunks[chunk_id]) {
                                    chunks[chunk_id] = 1;
                                    data.push(n);
                                }
                            }
                        }

                        if (!data.length && (Date.now() - time[i]) > (mXHRTimeoutMS * 3.1)) {
                            r = s ? '[TIMEOUT]' : '[ETHERR]';
                            data = ['Chunks are taking too long to complete... ', u];
                        }
                    }
                    else {
                        r = '[!]';
                        data = 'GlobalProgress.' + i + ' exists with no working chunks.';
                    }

                    if (data.length) {
                        var udata = {
                            i: i,
                            p: c,
                            d: data,
                            j: [prev, tlen],
                            s: s
                        };
                        if (i[0] === 'z') {
                            t = 'zip' + t;
                        }
                        console.error(t + ' stuck. ' + r, i, udata);
                        if (!d) {
                            srvlog(t + ' Stuck. ' + r, udata);
                        }
                    }
                    delete prev[i];
                }
                else {
                    time[i] = Date.now();
                    tlen[i] = Math.max(tlen[i] || 0, tp[i][0]);
                    prev[i] = tp[i][0];
                }
            }
        }
    }, mXHRTimeoutMS * 1.2);
}

function percent_megatitle() {
    var dl_r = 0,
        dl_t = 0,
        ul_r = 0,
        ul_t = 0,
        tp = $.transferprogress || {},
        dl_s = 0,
        ul_s = 0,
        zips = {},
        d_deg = 0,
        u_deg = 0;

    for (var i in dl_queue) {
        if (dl_queue.hasOwnProperty(i)) {
            var q = dl_queue[i];
            var t = q && tp[q.zipid ? 'zip_' + q.zipid : 'dl_' + q.id];

            if (t) {
                dl_r += t[0];
                dl_t += t[1];
                if (!q.zipid || !zips[q.zipid]) {
                    if (q.zipid) {
                        zips[q.zipid] = 1;
                    }
                    dl_s += t[2];
                }
            }
            else {
                dl_t += q && q.size || 0;
            }
        }
    }

    for (var i in ul_queue) {
        if (ul_queue.hasOwnProperty(i)) {
            var t = tp['ul_' + ul_queue[i].id]

            if (t) {
                ul_r += t[0];
                ul_t += t[1];
                ul_s += t[2];
            }
            else {
                ul_t += ul_queue[i].size || 0;
            }
        }
    }
    if (dl_t) {
        dl_t += tp['dlc'] || 0;
        dl_r += tp['dlc'] || 0
    }
    if (ul_t) {
        ul_t += tp['ulc'] || 0;
        ul_r += tp['ulc'] || 0
    }

    var x_ul = Math.floor(ul_r / ul_t * 100) || 0,
        x_dl = Math.floor(dl_r / dl_t * 100) || 0

    if (dl_t && ul_t) {
        t = ' \u2191 ' + x_dl + '% \u2193 ' + x_ul + '%';
    }
    else if (dl_t) {
        t = ' ' + x_dl + '%';
    }
    else if (ul_t) {
        t = ' ' + x_ul + '%';
    }
    else {
        t = '';
        $.transferprogress = {};
    }

    d_deg = 360 * x_dl / 100;
    u_deg = 360 * x_ul / 100;
    if (d_deg <= 180) {
        $('.download .nw-fm-chart0.right-c p').css('transform', 'rotate(' + d_deg + 'deg)');
        $('.download .nw-fm-chart0.left-c p').css('transform', 'rotate(0deg)');
    } else {
        $('.download .nw-fm-chart0.right-c p').css('transform', 'rotate(180deg)');
        $('.download .nw-fm-chart0.left-c p').css('transform', 'rotate(' + (d_deg - 180) + 'deg)');
    }
    if (u_deg <= 180) {
        $('.upload .nw-fm-chart0.right-c p').css('transform', 'rotate(' + u_deg + 'deg)');
        $('.upload .nw-fm-chart0.left-c p').css('transform', 'rotate(0deg)');
    } else {
        $('.upload .nw-fm-chart0.right-c p').css('transform', 'rotate(180deg)');
        $('.upload .nw-fm-chart0.left-c p').css('transform', 'rotate(' + (u_deg - 180) + 'deg)');
    }

    megatitle(t);
}

function hostname(url) {
    if (d) {
        ASSERT(url && /^http/.test(url), 'Invalid URL passed to hostname() -> ' + url);
    }
    url = ('' + url).match(/https?:\/\/([^.]+)/);
    return url && url[1];
}

// Quick hack for sane average speed readings
function bucketspeedometer(initialp) {
    return {
        interval: 200,
        num: 300,
        prevp: initialp,
        h: {},
        progress: function(p) {
            var now, min, oldest;
            var total;
            var t;

            now = NOW();
            now -= now % this.interval;

            this.h[now] = (this.h[now] || 0) + p - this.prevp;
            this.prevp = p;

            min = now - this.interval * this.num;

            oldest = now;
            total = 0;

            for (t in this.h) {
                if (t < min) {
                    delete this.h.bt;
                }
                else {
                    if (t < oldest) {
                        oldest = t;
                    }
                    total += this.h[t];
                }
            }

            if (now - oldest < 1000) {
                return 0;
            }

            p = 1000 * total / (now - oldest);

            // protect against negative returns due to repeated chunks etc.
            return p > 0 ? p : 0;
        }
    }
}

function moveCursortoToEnd(el) {
    if (typeof el.selectionStart === "number") {
        el.selectionStart = el.selectionEnd = el.value.length;
    }
    else if (typeof el.createTextRange !== "undefined") {
        el.focus();
        var range = el.createTextRange();
        range.collapse(false);
        range.select();
    }
    $(el).focus();
}

// Returns pixels position of element relative to document (top left corner)
function getHtmlElemPos(elem, n) {
    var xPos = 0;
    var yPos = 0;
    var sl, st, cl, ct;
    var pNode;
    while (elem) {
        pNode = elem.parentNode;
        sl = 0;
        st = 0;
        cl = 0;
        ct = 0;
        if (pNode && pNode.tagName && !/html|body/i.test(pNode.tagName)) {
            if (typeof n === 'undefined') // count this in, except for overflow huge menu
            {
                sl = elem.scrollLeft;
                st = elem.scrollTop;
            }
            cl = elem.clientLeft;
            ct = elem.clientTop;
            xPos += (elem.offsetLeft - sl + cl);
            yPos += (elem.offsetTop - st - ct);
        }
        elem = elem.offsetParent;
    }
    return {
        x: xPos,
        y: yPos
    };
}

function disableDescendantFolders(id, pref) {
    var folders = [];
    for (var i in M.c[id]) {
        if (M.d[i] && M.d[i].t === 1 && M.d[i].name) {
            folders.push(M.d[i]);
        }
    }
    for (var i in folders) {
        var sub = false;
        var fid = folders[i].h;

        for (var h in M.c[fid]) {
            if (M.d[h] && M.d[h].t) {
                sub = true;
                break;
            }
        }
        $(pref + fid).addClass('disabled');
        if (sub) {
            this.disableDescendantFolders(fid, pref);
        }
    }

    return true;
}

function ucfirst(str) {
    //  discuss at: http://phpjs.org/functions/ucfirst/
    // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // bugfixed by: Onno Marsman
    // improved by: Brett Zamir (http://brett-zamir.me)
    //   example 1: ucfirst('kevin van zonneveld');
    //   returns 1: 'Kevin van zonneveld'

    str += '';
    var f = str.charAt(0)
        .toUpperCase();
    return f + str.substr(1);
}

function readLocalStorage(name, type, val) {
    var v;
    if (localStorage[name]) {
        var f = 'parse' + ucfirst(type);
        v = localStorage[name];

        if (typeof window[f] === "function") {
            v = window[f](v);
        }

        if (val && ((val.min && val.min > v) || (val.max && val.max < v))) {
            v = null;
        }
    }
    return v || (val && val.def);
}

function obj_values(obj) {
    var vals = [];

    Object.keys(obj).forEach(function(memb) {
        if (obj.hasOwnProperty(memb)) {
            vals.push(obj[memb]);
        }
    });

    return vals;
}

function _wrapFnWithBeforeAndAfterEvents(fn, eventSuffix, dontReturnPromises) {
    var logger = MegaLogger.getLogger("beforeAfterEvents: " + eventSuffix);

    return function() {
        var self = this;
        var args = toArray(arguments);

        var event = new $.Event("onBefore" + eventSuffix);
        self.trigger(event, args);

        if (event.isPropagationStopped()) {
            logger.debug("Propagation stopped for event: ", event);
            if (dontReturnPromises) {
                return false;
            }
            else {
                return MegaPromise.reject("Propagation stopped by onBefore" + eventSuffix);
            }

        }
        if (typeof(event.returnedValue) !== "undefined") {
            args = event.returnedValue;
        }

        var returnedValue = fn.apply(self, args);

        var done = function() {
            var event2 = new $.Event("onAfter" + eventSuffix);
            self.trigger(event2, args.concat(returnedValue));

            if (event2.isPropagationStopped()) {
                logger.debug("Propagation stopped for event: ", event);
                if (dontReturnPromises) {
                    return false;
                }
                else {
                    return MegaPromise.reject("Propagation stopped by onAfter" + eventSuffix);
                }
            }
        };

        if (returnedValue && returnedValue.then) {
            returnedValue.then(function() {
                done();
            });
        }
        else {
            done();
        }

        return returnedValue;
    }
}

function hex2bin(hex) {
    var bytes = [];

    for (var i = 0; i < hex.length - 1; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }

    return String.fromCharCode.apply(String, bytes);
}

/**
 * Detects if Flash is enabled or disabled in the user's browser
 * From http://stackoverflow.com/a/20095467
 * @returns {Boolean}
 */
function flashIsEnabled() {

    var flashEnabled = false;

    try {
        var flashObject = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
        if (flashObject) {
            flashEnabled = true;
        }
    }
    catch (e) {
        if (navigator.mimeTypes
                && (navigator.mimeTypes['application/x-shockwave-flash'] !== undefined)
                && (navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin)) {
            flashEnabled = true;
        }
    }

    return flashEnabled;
}

/**
 * Gets the current base URL of the page (protocol + hostname) e.g. If on beta.mega.nz it will return https://beta.mega.nz.
 * If on the browser extension it will return the default https://mega.nz. If on localhost it will return https://mega.nz.
 * This can be used to create external links, for example file downloads https://mega.nz/#!qRN33YbK!o4Z76qDqPbiK2G0I...
 * @returns {String}
 */
function getBaseUrl() {
    return 'https://' + (((location.protocol === 'https:') && location.host) || 'mega.nz');
}

/**
 * Like getBaseUrl(), but suitable for extensions to point to internal resources.
 * This should be the same than `bootstaticpath + urlrootfile` except that may differ
 * from a public entry point (Such as the Firefox extension and its mega: protocol)
 * @returns {string}
 */
function getAppBaseUrl() {
    var l = location;
    return (l.origin !== 'null' && l.origin || (l.protocol + '//' + l.hostname)) + l.pathname;
}

/**
 * http://stackoverflow.com/a/16344621/402133
 *
 * @param ms
 * @returns {string}
 */
function ms2Time(ms) {
    var secs = ms / 1000;
    ms = Math.floor(ms % 1000);
    var minutes = secs / 60;
    secs = Math.floor(secs % 60);
    var hours = minutes / 60;
    minutes = Math.floor(minutes % 60);
    hours = Math.floor(hours % 24);
    return hours + ":" + minutes + ":" + secs;
}

function secToDuration(s, sep) {
    var dur = ms2Time(s * 1000).split(":");
    var durStr = "";
    sep = sep || ", ";
    if (!secToDuration.regExp) { //regexp compile cache
        secToDuration.regExp = {};
    }

    if (!secToDuration.regExp[sep]) {
        secToDuration.regExp[sep] = new RegExp("" + sep + "$");
    }

    for (var i = 0; i < dur.length; i++) {
        var unit;
        var v = dur[i];
        if (v === "0") {
            if (durStr.length !== 0 && i !== 0) {
                continue;
            }
            else if (i < 2) {
                continue;
            }
        }

        if (i === 0) {
            unit = v !== 1 ? "hours" : "hour";
        }
        else if (i === 1) {
            unit = v !== 1 ? "minutes" : "minute";
        }
        else if (i === 2) {
            unit = v !== 1 ? "seconds" : "second";
        }
        else {
            throw new Error("this should never happen.");
        }

        durStr += v + " " + unit + sep;
    }

    return durStr.replace(secToDuration.regExp[sep], "");
}

function generateAnonymousReport() {
    var $promise = new MegaPromise();
    var report = {};
    report.ua = navigator.userAgent;
    report.ut = u_type;
    report.pbm = !!window.Incognito;
    report.io = window.dlMethod && dlMethod.name;
    report.sb = +('' + $('script[src*="secureboot"]').attr('src')).split('=').pop();
    report.tp = $.transferprogress;
    if (!megaChatIsReady) {
        report.karereState = '#disabled#';
    }
    else {
        report.karereState = megaChat.karere.getConnectionState();
        report.karereCurrentConnRetries = megaChat.karere._connectionRetries;
        report.myPresence = megaChat.karere.getPresence(megaChat.karere.getJid());
        report.karereServer = megaChat.karere.connection.service;
        report.numOpenedChats = Object.keys(megaChat.chats).length;
        report.haveRtc = megaChat.rtc ? true : false;
        if (report.haveRtc) {
            report.rtcStatsAnonymousId = megaChat.rtc.ownAnonId;
        }
    }

    var chatStates = {};
    var userAnonMap = {};
    var userAnonIdx = 0;
    var roomUniqueId = 0;
    var roomUniqueIdMap = {};

    if(megaChatIsReady && megaChat.chats) {
        megaChat.chats.forEach(function (v, k) {
            var participants = v.getParticipants();

            participants.forEach(function (v, k) {
                var cc = megaChat.getContactFromJid(v);
                if (cc && cc.u && !userAnonMap[cc.u]) {
                    userAnonMap[cc.u] = {
                        anonId: userAnonIdx++ + rand(1000),
                        pres: megaChat.karere.getPresence(v)
                    };
                }
                participants[k] = cc && cc.u ? userAnonMap[cc.u] : v;
            });

            var r = {
                'roomUniqueId': roomUniqueId,
                'roomState': v.getStateAsText(),
                'roomParticipants': participants
            };

            chatStates[roomUniqueId] = r;
            roomUniqueIdMap[k] = roomUniqueId;
            roomUniqueId++;
        });

        if (report.haveRtc) {
            Object.keys(megaChat.plugins.callManager.callSessions).forEach(function (k) {
                var v = megaChat.plugins.callManager.callSessions[k];

                var r = {
                    'callStats': v.callStats,
                    'state': v.state
                };

                var roomIdx = roomUniqueIdMap[v.room.roomJid];
                if (!roomIdx) {
                    roomUniqueId += 1; // room which was closed, create new tmp id;
                    roomIdx = roomUniqueId;
                }
                if (!chatStates[roomIdx]) {
                    chatStates[roomIdx] = {};
                }
                if (!chatStates[roomIdx].callSessions) {
                    chatStates[roomIdx].callSessions = [];
                }
                chatStates[roomIdx].callSessions.push(r);
            });
        };

        report.chatRoomState = chatStates;
    };

    if (is_chrome_firefox) {
        report.mo = mozBrowserID + '::' + is_chrome_firefox + '::' + mozMEGAExtensionVersion;
    }

    var apireqHaveBackOffs = {};
    apixs.forEach(function(v, k) {
        if (v.backoff > 0) {
            apireqHaveBackOffs[k] = v.backoff;
        }
    });

    if (Object.keys(apireqHaveBackOffs).length > 0) {
        report.apireqbackoffs = apireqHaveBackOffs;
    }

    report.hadLoadedRsaKeys = u_authring.RSA && Object.keys(u_authring.RSA).length > 0;
    report.hadLoadedEd25519Keys = u_authring.Ed25519 && Object.keys(u_authring.Ed25519).length > 0;
    report.totalDomElements = $("*").length;
    report.totalScriptElements = $("script").length;

    report.totalD = Object.keys(M.d).length;
    report.totalU = M.u.size();
    report.totalC = Object.keys(M.c).length;
    report.totalIpc = Object.keys(M.ipc).length;
    report.totalOpc = Object.keys(M.opc).length;
    report.totalPs = Object.keys(M.ps).length;
    report.l = lang;
    report.scrnSize = window.screen.availWidth + "x" + window.screen.availHeight;

    if (typeof(window.devicePixelRatio) !== 'undefined') {
        report.pixRatio = window.devicePixelRatio;
    }

    try {
        report.perfTiming = JSON.parse(JSON.stringify(window.performance.timing));
        report.memUsed = window.performance.memory.usedJSHeapSize;
        report.memTotal = window.performance.memory.totalJSHeapSize;
        report.memLim = window.performance.memory.jsHeapSizeLimit;
    }
    catch (e) {}

    report.jslC = jslcomplete;
    report.jslI = jsli;
    report.scripts = {};
    report.host = window.location.host;

    var promises = [];

    $('script').each(function() {
        var self = this;
        var src = self.src.replace(window.location.host, "$current");
        if (is_chrome_firefox) {
            if (!promises.length) {
                promises.push(MegaPromise.resolve());
            }
            report.scripts[self.src] = false;
            return;
        }
        promises.push(
            $.ajax({
                url: self.src,
                dataType: "text"
            })
            .done(function(r) {
                report.scripts[src] = [
                        MurmurHash3(r, 0x4ef5391a),
                        r.length
                    ];
            })
            .fail(function(r) {
                report.scripts[src] = false;
            })
        );
    });

    report.version = null; // TODO: how can we find this?

    MegaPromise.allDone(promises)
        .done(function() {
            $promise.resolve(report);
        })
        .fail(function() {
            $promise.resolve(report)
        });

    return $promise;
}

function __(s) { //TODO: waiting for @crodas to commit the real __ code.
    return s;
}

function MegaEvents() {}
MegaEvents.prototype.trigger = function(name, args) {
    if (!(this._events && this._events.hasOwnProperty(name))) {
        return false;
    }

    if (d > 1) {
        console.log(' >>> Triggering ' + name, this._events[name].length, args);
    }

    args = args || []
    var done = 0,
        evs = this._events[name];
    for (var i in evs) {
        try {
            evs[i].apply(null, args);
        }
        catch (ex) {
            console.error(ex);
        }
        ++done;
    }
    return done;
};
MegaEvents.prototype.on = function(name, callback) {
    if (!this._events) {
        this._events = {};
    }
    if (!this._events.hasOwnProperty(name)) {
        this._events[name] = [];
    }
    this._events[name].push(callback);
    return this;
};

(function(scope) {
    var MegaAnalytics = function(id) {
        this.loggerId = id;
        this.sessionId = makeid(16);
    };
    MegaAnalytics.prototype.log = function(c, e, data) {

        data = data || {};
        data = $.extend(
            true, {}, {
                'aid': this.sessionId,
                'lang': typeof(lang) !== 'undefined' ? lang : null,
                'browserlang': navigator.language,
                'u_type': typeof(u_type) !== 'undefined' ? u_type : null
            },
            data
        );

        if (c === 'pro' && sessionStorage.proref) {
            data['ref'] = sessionStorage.proref;
        }

        var msg = JSON.stringify({
            'c': c,
            'e': e,
            'data': data
        });

        if (d) {
            console.log("megaAnalytics: ", c, e, data);
        }
        if (window.location.toString().indexOf("mega.dev") !== -1) {
            return;
        }
        api_req({
            a: 'log',
            e: this.loggerId,
            m: msg
        }, {});
    };
    scope.megaAnalytics = new MegaAnalytics(99999);
})(this);


function constStateToText(enumMap, state) {
    var txt = false;
    $.each(enumMap, function(k, v) {
        if(state == v) {
            txt = k;

            return false; // break
        }
    });

    return txt === false ? "(not found: " + state + ")" : txt;
};

/**
 * Helper function that will do some assert()s to guarantee that the new state is correct/allowed
 *
 * @param currentState
 * @param newState
 * @param allowedStatesMap
 * @param enumMap
 * @throws AssertionError
 */
function assertStateChange(currentState, newState, allowedStatesMap, enumMap) {
    var checksAvailable = allowedStatesMap[currentState];
    var allowed = false;
    if(checksAvailable) {
        checksAvailable.forEach(function(allowedState) {
            if(allowedState === newState) {
                allowed = true;
                return false; // break;
            }
        });
    }
    if(!allowed) {
        assert(
            false,
            'State change from: ' + constStateToText(enumMap, currentState) + ' to ' +
            constStateToText(enumMap, newState) + ' is not in the allowed state transitions map.'
        );
    }
}

/**
 * Promise-based XHR request
 * @param {Mixed} aURLOrOptions URL or options
 * @param {Mixed} aData         data to send, optional
 */
mega.utils.xhr = function megaUtilsXHR(aURLOrOptions, aData) {
    /* jshint -W074 */
    var xhr;
    var url;
    var method;
    var options;
    var promise = new MegaPromise();

    if (typeof aURLOrOptions === 'object') {
        options = aURLOrOptions;
        url = options.url;
    }
    else {
        options = {};
        url = aURLOrOptions;
    }
    aURLOrOptions = undefined;

    aData = options.data || aData;
    method = options.method || (aData && 'POST') || 'GET';

    xhr = getxhr();

    if (typeof options.prepare === 'function') {
        options.prepare(xhr);
    }

    xhr.onloadend = function(ev) {
        if (this.status === 200) {
            promise.resolve(ev, this.response);
        }
        else {
            promise.reject(ev);
        }
    };

    try {
        if (d) {
            MegaLogger.getLogger('muXHR').info(method + 'ing', url, options, aData);
        }
        xhr.open(method, url);

        if (options.type) {
            xhr.responseType = options.type;
            if (xhr.responseType !== options.type) {
                xhr.abort();
                throw new Error('Unsupported responseType');
            }
        }

        if (typeof options.beforeSend === 'function') {
            options.beforeSend(xhr);
        }

        if (is_chrome_firefox) {
            xhr.setRequestHeader('Origin', getBaseUrl(), false);
        }

        xhr.send(aData);
    }
    catch (ex) {
        promise.reject(ex);
    }

    xhr = options = undefined;

    return promise;
};

/**
 *  Retrieve a call stack
 *  @return {String}
 */
mega.utils.getStack = function megaUtilsGetStack() {
    var stack;

    if (is_chrome_firefox) {
        stack = Components.stack.formattedStack;
    }

    if (!stack) {
        stack = (new Error()).stack;

        if (!stack) {
            try {
                throw new Error();
            }
            catch(e) {
                stack = e.stack;
            }
        }
    }

    return stack;
};

/**
 *  Check whether there are pending transfers.
 *
 *  @return {Boolean}
 */
mega.utils.hasPendingTransfers = function megaUtilsHasPendingTransfers() {
    return ((fminitialized && dlmanager.isDownloading) || ulmanager.isUploading);
};

/**
 *  Abort all pending transfers.
 *
 *  @return {Promise}
 *          Resolved: Transfers were aborted
 *          Rejected: User canceled confirmation dialog
 *
 *  @details This needs to be used when an operation requires that
 *           there are no pending transfers, such as a logout.
 */
mega.utils.abortTransfers = function megaUtilsAbortTransfers() {
    var promise = new MegaPromise();

    if (!mega.utils.hasPendingTransfers()) {
        promise.resolve();
    }
    else {
        msgDialog('confirmation', l[967], l[377] + ' ' + l[507] + '?', false, function(doIt) {
            if (doIt) {
                if (dlmanager.isDownloading) {
                    dlmanager.abort(null);
                }
                if (ulmanager.isUploading) {
                    ulmanager.abort(null);
                }

                mega.utils.resetUploadDownload();
                loadingDialog.show();
                var timer = setInterval(function() {
                    if (!mega.utils.hasPendingTransfers()) {
                        clearInterval(timer);
                        promise.resolve();
                    }
                }, 350);
            }
            else {
                promise.reject();
            }
        });
    }

    return promise;
};

/**
 * On transfers completion cleanup
 */
mega.utils.resetUploadDownload = function megaUtilsResetUploadDownload() {
    if (!ul_queue.some(isQueueActive)) {
        ul_queue = new UploadQueue();
        ulmanager.isUploading = false;
        ASSERT(ulQueue._running === 0, 'ulQueue._running inconsistency on completion');
        ulQueue._pending = [];
    }
    if (!dl_queue.some(isQueueActive)) {
        dl_queue = new DownloadQueue();
        dlmanager.isDownloading = false;
    }

    if (!dlmanager.isDownloading && !ulmanager.isUploading) {
        clearXhr(); /* destroy all xhr */

        $('.transfer-pause-icon').addClass('disabled');
        $('.nw-fm-left-icon.transfers').removeClass('transfering');
        $('.transfers .nw-fm-percentage li p').css('transform', 'rotate(0deg)');
        M.tfsdomqueue = {};
        GlobalProgress = {};
        delete $.transferprogress;
        fm_tfsupdate();
        if ($.mTransferAnalysis) {
            clearInterval($.mTransferAnalysis);
            delete $.mTransferAnalysis;
        }
        $('.transfer-panel-title').html(l[104]);
    }

    if (d) {
        dlmanager.logger.info("resetUploadDownload", ul_queue.length, dl_queue.length);
    }

    fm_tfsupdate();
    Later(percent_megatitle);
};

/**
 *  Reload the site cleaning databases & session/localStorage.
 *
 *  Under non-activated/registered accounts this
 *  will perform a former normal cloud reload.
 */
mega.utils.reload = function megaUtilsReload() {
    function _reload() {
        var u_sid = u_storage.sid,
            u_key = u_storage.k,
            privk = u_storage.privk,
            debug = !!u_storage.d;

        localStorage.clear();
        sessionStorage.clear();

        u_storage.sid = u_sid;
        u_storage.privk = privk;
        u_storage.k = u_key;
        u_storage.wasloggedin = true;

        if (debug) {
            u_storage.d = true;
            if (location.host !== 'mega.nz') {
                u_storage.dd = true;
                if (!is_extension) {
                    u_storage.jj = true;
                }
            }
        }

        location.reload(true);
    }

    if (u_type !== 3) {
        stopsc();
        stopapi();
        if (typeof mDB === 'object' && !pfid) {
            mDBreload();
        } else {
            loadfm(true);
        }
    }
    else {
        // Show message that this operation will destroy and reload the data stored by MEGA in the browser
        msgDialog('confirmation', l[761], l[6995], l[6994], function(doIt) {
            if (doIt) {
                if (!mBroadcaster.crossTab.master || mBroadcaster.crossTab.slaves.length) {
                    msgDialog('warningb', l[882], l[7157]);
                }
                if (mBroadcaster.crossTab.master) {
                    mega.utils.abortTransfers().then(function() {
                        loadingDialog.show();
                        stopsc();
                        stopapi();

                        MegaPromise.allDone([
                            MegaDB.dropAllDatabases(/*u_handle*/),
                            mega.utils.clearFileSystemStorage()
                        ]).then(function(r) {
                                console.debug('megaUtilsReload', r);
                                _reload();
                            });
                    });
                }
            }
        });
    }
};

/**
 * Clear the data on FileSystem storage.
 *
 * mega.utils.clearFileSystemStorage().always(console.debug.bind(console));
 */
mega.utils.clearFileSystemStorage = function megaUtilsClearFileSystemStorage() {
    function _done(status) {
        if (promise) {
            if (status !== 0x7ffe) {
                promise.reject(status);
            }
            else {
                promise.resolve();
            }
            promise = undefined;
        }
    }

    if (is_chrome_firefox || !window.requestFileSystem) {
        return MegaPromise.resolve();
    }

    setTimeout(function() {
        _done();
    }, 4000);

    var promise = new MegaPromise();

    (function _clear(storagetype) {
        function onInitFs(fs) {
            var dirReader = fs.root.createReader();
            dirReader.readEntries(function (entries) {
                for (var i = 0, entry; entry = entries[i]; ++i) {
                    if (entry.isDirectory && entry.name === 'mega') {
                        console.debug('Cleaning storage...', entry);
                        entry.removeRecursively(_next.bind(null, 0x7ffe), _next);
                        break;
                    }
                }
            });
        }
        function _next(status) {
            if (storagetype === 0) {
                _clear(1);
            }
            else {
                _done(status);
            }
        }
        window.requestFileSystem(storagetype, 1024, onInitFs, _next);
    })(0);

    return promise;
};

/**
 * Neuter an ArrayBuffer
 * @param {Mixed} ab ArrayBuffer/TypedArray
 */
mega.utils.neuterArrayBuffer = function neuter(ab) {
    if (!(ab instanceof ArrayBuffer)) {
        ab = ab && ab.buffer;
    }
    try {
        if (typeof ArrayBuffer.transfer === 'function') {
            ArrayBuffer.transfer(ab, 0); // ES7
        }
        else {
            if (!neuter.dataWorker) {
                neuter.dataWorker = new Worker("data:application/javascript,var%20d%3B");
            }
            neuter.dataWorker.postMessage(ab, [ab]);
        }
        if (ab.byteLength !== 0) {
            throw new Error('Silently failed! -- ' + ua);
        }
    }
    catch (ex) {
        if (d) {
            console.warn('Cannot neuter ArrayBuffer', ab, ex);
        }
    }
};

/**
 *  Kill session and Logout
 */
mega.utils.logout = function megaUtilsLogout() {
    mega.utils.abortTransfers().then(function() {
        var finishLogout = function() {
            if (--step === 0) {
                u_logout(true);
                if (typeof aCallback === 'function') {
                    aCallback();
                }
                else {
                    document.location.reload();
                }
            }
        }, step = 1;
        loadingDialog.show();
        if (typeof mDB === 'object' && mDB.drop) {
            step++;
            mFileManagerDB.exec('drop').always(finishLogout);
        }
        if (u_privk) {
            // Use the 'Session Management Logout' API call to kill the current session
            api_req({ 'a': 'sml' }, { callback: finishLogout });
        }
        else {
            finishLogout();
        }

    });
}

/**
 * Perform a normal logout
 *
 * @param {Function} aCallback optional
 */
function mLogout(aCallback) {
    var cnt = 0;
    if (M.c[M.RootID] && u_type === 0) {
        for (var i in M.c[M.RootID]) {
            cnt++;
        }
    }
    if (u_type === 0 && cnt > 0) {
        msgDialog('confirmation', l[1057], l[1058], l[1059], function (e) {
            if (e) {
                mega.utils.logout();
            }
        });
    }
    else {
        mega.utils.logout();
    }
}

/**
 * Perform a strict logout, by removing databases
 * and cleaning sessionStorage/localStorage.
 *
 * @param {String} aUserHandle optional
 */
function mCleanestLogout(aUserHandle) {
    if (u_type !== 0 && u_type !== 3) {
        throw new Error('Operation not permitted.');
    }

    mLogout(function() {
        MegaDB.dropAllDatabases(aUserHandle)
            .always(function(r) {
                console.debug('mCleanestLogout', r);

                localStorage.clear();
                sessionStorage.clear();

                setTimeout(function() {
                    location.reload(true);
                }, 7e3);
            });
    });
}


// Initialize Rubbish-Bin Cleaning Scheduler
mBroadcaster.addListener('crossTab:master', function _setup() {
    var RUBSCHED_WAITPROC = 120 * 1000;
    var RUBSCHED_IDLETIME =   4 * 1000;
    var timer, updId;

    mBroadcaster.once('crossTab:leave', _exit);

    // The fm must be initialized before proceeding
    if (!folderlink && fminitialized) {
        _fmready();
    }
    else {
        mBroadcaster.addListener('fm:initialized', _fmready);
    }

    function _fmready() {
        if (!folderlink) {
            _init();
            return 0xdead;
        }
    }

    function _update(enabled) {
        _exit();
        if (enabled) {
            _init();
        }
    }

    function _exit() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (updId) {
            mBroadcaster.removeListener(updId);
            updId = null;
        }
    }

    function _init() {
        // if (d) console.log('Initializing Rubbish-Bin Cleaning Scheduler');

        updId = mBroadcaster.addListener('fmconfig:rubsched', _update);
        if (fmconfig.rubsched) {
            timer = setInterval(function() {
                _proc();
            }, RUBSCHED_WAITPROC);
        }
    }

    function _proc() {

        // Do nothing unless the user has been idle
        if (Date.now() - lastactive < RUBSCHED_IDLETIME) {
            return;
        }

        _exit();

        // Mode 14 - Remove files older than X days
        // Mode 15 - Keep the Rubbish-Bin under X GB
        var mode = String(fmconfig.rubsched).split(':');
        var xval = mode[1];
        mode = +mode[0];

        var handler = _rubSchedHandler[mode];
        if (!handler) {
            throw new Error('Invalid RubSchedHandler', mode);
        }

        if (d) {
            console.log('Running Rubbish-Bin Cleaning Scheduler', mode, xval);
            console.time('rubsched');
        }

        var nodes = Object.keys(M.c[M.RubbishID] || {}), rubnodes = [];

        for (var i in nodes) {
            var node = M.d[nodes[i]];
            if (!node) {
                console.error('Invalid node', nodes[i]);
                continue;
            }
            if (node.t == 1) {
                rubnodes = rubnodes.concat(fm_getnodes(node.h));
            }
            rubnodes.push(node.h);
        }

        rubnodes.sort(handler.sort);
        var rNodes = handler.log(rubnodes);

        // if (d) console.log('rubnodes', rubnodes, rNodes);

        var handles = [];
        if (handler.purge(xval)) {
            for (var i in rubnodes) {
                var node = M.d[rubnodes[i]];

                if (handler.remove(node, xval)) {
                    handles.push(node.h);

                    if (handler.ready(node, xval)) {
                        break;
                    }
                }
            }

            // if (d) console.log('RubSched-remove', handles);

            if (handles.length) {
                var inRub = (M.RubbishID === M.currentrootid);

                handles.map(function(handle) {
                    M.delNode(handle);
                    api_req({a: 'd', n: handle, i: requesti});

                    if (inRub) {
                        $('.grid-table.fm#' + handle).remove();
                        $('.file-block#' + handle).remove();
                    }
                });

                if (inRub) {
                    if (M.viewmode) {
                        iconUI();
                    }
                    else {
                        gridUI();
                    }
                    treeUI();
                }
            }
        }

        if (d) {
            console.timeEnd('rubsched');
        }

        // Once we ran for the first time, set up a long running scheduler
        RUBSCHED_WAITPROC = 4 * 3600 * 1e3;
        _init();
    }

    /**
     * Scheduler Handlers
     *   Sort:    Sort nodes specifically for the handler purpose
     *   Log:     Keep a record of nodes if required and return a debugable array
     *   Purge:   Check whether the Rubbish-Bin should be cleared
     *   Remove:  Return true if the node is suitable to get removed
     *   Ready:   Once a node is removed, check if the criteria has been meet
     */
    var _rubSchedHandler = {
        // Remove files older than X days
        "14": {
            sort: function(n1, n2) {
                return M.d[n1].ts > M.d[n2].ts;
            },
            log: function(nodes) {
                return d && nodes.map(function(node) {
                    return M.d[node].name + '~' + (new Date(M.d[node].ts*1000)).toISOString();
                });
            },
            purge: function(limit) {
                return true;
            },
            remove: function(node, limit) {
                limit = (Date.now() / 1e3) - (limit * 86400);
                return node.ts < limit;
            },
            ready: function(node, limit) {
                return false;
            }
        },
        // Keep the Rubbish-Bin under X GB
        "15": {
            sort: function(n1, n2) {
                n1 = M.d[n1].s || 0;
                n2 = M.d[n2].s || 0;
                return n1 < n2;
            },
            log: function(nodes) {
                var pnodes, size = 0;

                pnodes = nodes.map(function(node) {
                    size += (M.d[node].s || 0);
                    return M.d[node].name + '~' + bytesToSize(M.d[node].s);
                });

                this._size = size;

                return pnodes;
            },
            purge: function(limit) {
                return this._size > (limit * 1024 * 1024 * 1024);
            },
            remove: function(node, limit) {
                return true;
            },
            ready: function(node, limit) {
                this._size -= (node.s || 0);
                return this._size < (limit * 1024 * 1024 * 1024);
            }
        }
    }
});

/** document.hasFocus polyfill */
mBroadcaster.once('startMega', function() {
    if (typeof document.hasFocus !== 'function') {
        var hasFocus = true;

        $(window)
            .bind('focus', function() {
                hasFocus = true;
            })
            .bind('blur', function() {
                hasFocus = false;
            });

        document.hasFocus = function() {
            return hasFocus;
        };
    }
});

/**
 * Cross-tab communication using WebStorage
 */
var watchdog = Object.freeze({
    Strg: {},
    // Tag prepended to messages to identify watchdog-events
    eTag: '$WDE$!_',
    // ID to identify tab's origin
    wdID: (Math.random() * Date.now()),

    /** setup watchdog/webstorage listeners */
    setup: function() {
        if (window.addEventListener) {
            window.addEventListener('storage', this, false);
        }
        else if (window.attachEvent) {
            window.attachEvent('onstorage', this.handleEvent.bind(this));
        }
    },

    /**
     * Notify watchdog event/message
     * @param {String} msg  The message
     * @param {String} data Any data sent to other tabs, optional
     */
    notify: function(msg, data) {
        data = { origin: this.wdID, data: data, sid: Math.random()};
        localStorage.setItem(this.eTag + msg, JSON.stringify(data));
        if (d) {
            console.log('mWatchDog Notifying', this.eTag + msg, localStorage[this.eTag + msg]);
        }
    },

    /** Handle watchdog/webstorage event */
    handleEvent: function(ev) {
        if (String(ev.key).indexOf(this.eTag) !== 0) {
            return;
        }
        if (d) {
            console.debug('mWatchDog ' + ev.type + '-event', ev.key, ev.newValue, ev);
        }

        var msg = ev.key.substr(this.eTag.length);
        var strg = JSON.parse(ev.newValue || '""');

        if (!strg || strg.origin === this.wdID) {
            if (d) {
                console.log('Ignoring mWatchDog event', msg, strg);
            }
            return;
        }

        switch (msg) {
            case 'loadfm_done':
                if (this.Strg.login === strg.origin) {
                    location.assign(location.pathname);
                }
                break;

            case 'login':
            case 'createuser':
                loadingDialog.show();
                this.Strg.login = strg.origin;
                break;

            case 'logout':
                u_logout(-0xDEADF);
                location.reload();
                break;
        }

        delete localStorage[ev.key];
    }
});
watchdog.setup();

/**
 * Simple alias that will return a random number in the range of: a < b
 *
 * @param a {Number} min
 * @param b {Number} max
 * @returns {*}
 */
function rand_range(a, b) {
    return Math.random() * (b - a) + a;
};

// FIXME: This is a "Dirty Hack" (TM) that needs to be removed as soon as
//        the original problem is found and resolved.
if (typeof sjcl !== 'undefined') {
    // We need to track SJCL exceptions for ticket #2348
    sjcl.exception.invalid = function(message) {
        this.toString = function() {
            return "INVALID: " + this.message;
        };
        this.message = message;
        this.stack = mega.utils.getStack();
    };
}

(function($, scope) {
    /**
     * Share related operations.
     *
     * @param opts {Object}
     *
     * @constructor
     */
    var Share = function(opts) {

        var self = this;
        var defaultOptions = {
        };

        self.options = $.extend(true, {}, defaultOptions, opts);    };

    /**
     * isShareExists
     *
     * Checking if there's available shares for selected nodes.
     * @param {Array} nodes Holds array of ids from selected folders/files (nodes).
     * @param {Boolean} fullShare Do we need info about full share.
     * @param {Boolean} pendingShare Do we need info about pending share .
     * @param {Boolean} linkShare Do we need info about link share 'EXP'.
     * @returns {Boolean} result.
     */
    Share.prototype.isShareExist = function(nodes, fullShare, pendingShare, linkShare) {

        var self = this;

        var shares = {}, length;

        for (var i in nodes) {
            if (nodes.hasOwnProperty(i)) {

                // Look for full share
                if (fullShare) {
                    shares = M.d[nodes[i]].shares;

                    // Look for link share
                    if (linkShare) {
                        if (shares && Object.keys(shares).length) {
                            return true;
                        }
                    }
                    else { // Exclude folder/file links,
                        if (shares) {
                            length = Object.keys(shares).length;
                            if (length) {
                                if (!shares.EXP || (shares.EXP && length > 1)) {
                                    return true;
                                }
                            }

                        }
                    }
                }

                // Look for pending share
                if (pendingShare) {
                    shares = M.ps[nodes[i]];

                    if (M.ps && shares && Object.keys(shares).length) {
                        return true;
                    }
                }
            }
        }

        return false;
    };

    /**
     * hasExportLink, check if at least one selected item have public link.
     *
     * @param {String|Array} nodes Node id or array of nodes string
     * @returns {Boolean}
     */
    Share.prototype.hasExportLink = function(nodes) {

        var result = false,
            node;

        // Loop through all selected items
        $.each(nodes, function(index, value) {
            node = M.d[value];
            if (node.ph && node.shares && node.shares.EXP) {
                result = true;
                return false;// Stop further $.each loop execution

            }
        });

        return result;
    };

    /**
     * getShares
     *
     * Is there available share for nodes.
     * @param {String} node Node id.
     * @param {Boolean} fullShare Inclde results for full shares.
     * @param {Boolean} pendingShare Include results for pending shares.
     * @param {Boolean} linkShare Include results for foder/file links.
     * @returns {Array} result Array of user ids.
     */
    Share.prototype.getShares = function(nodes, fullShare, pendingShare, linkShare) {

        var self = this;

        var result, shares, length;

        for (var i in nodes) {
            if (nodes.hasOwnProperty(i)) {
                result = [];

                // Look for full share
                if (fullShare) {
                    shares = M.d[nodes[i]].shares;

                    // Look for link share
                    if (linkShare) {
                        if (shares && Object.keys(shares).length) {
                            result.push(self.loopShares(shares), linkShare);
                        }
                    }
                    else { // Exclude folder/file links,
                        if (shares) {
                            length = Object.keys(shares).length;
                            if (length) {
                                if (!shares.EXP || (shares.EXP && length > 1)) {
                                    result.push(self.loopShares(shares), linkShare);
                                }
                            }

                        }
                    }
                }

                // Look for pending share
                if (pendingShare) {
                    shares = M.ps[nodes[i]];
                    if (M.ps && shares && Object.keys(shares).length) {
                        result.push(self.loopShares(shares), linkShare);
                    }
                }
            }
        }

        return result;
    };

    /**
     * loopShares
     *
     * Loops through all shares and returns users id.
     * @param {Object} shares.
     * @param {Boolean} linkShare Do we need info about link share.
     * @returns {Array} user id.
     */
    Share.prototype.loopShares = function(shares, linkShare) {

        var self = this;

        var result = [],
            exclude = 'EXP',
            index;

        $.each(shares, function(index, value) {
           result.push(index);
        });

        // Remove 'EXP'
        if (!linkShare) {
            index = result.indexOf(exclude);

            if (index !== -1) {
                result = result.splice(index, 1);
            }
        }

        return result;
    };

    // export
    scope.mega = scope.mega || {};
    scope.mega.Share = Share;
})(jQuery, window);

(function($, scope) {
    /**
     * Nodes related operations.
     *
     * @param opts {Object}
     *
     * @constructor
     */
    var Nodes = function(opts) {

        var self = this;
        var defaultOptions = {
        };

        self.options = $.extend(true, {}, defaultOptions, opts);    };

    /**
     * getChildNodes
     *
     * Loops through all subdirs of given node, as result gives array of subdir nodes.
     * @param {String} id: node id.
     * @param {Array} nodesId.
     * @returns {Array} Child nodes id.
     */
    Nodes.prototype.getChildNodes = function(id, nodesId) {

        var self = this;

        var subDirs = nodesId;

        if (subDirs) {
            if (subDirs.indexOf(id) === -1) {
                subDirs.push(id);
            }
        }
        else {
            // Make subDirs an array
            subDirs = [id];
        }

        for (var item in M.c[id]) {
            if (M.c[id].hasOwnProperty(item)) {

                // Prevent duplication
                if (subDirs && subDirs.indexOf(item) === -1) {
                    subDirs.push(item);
                }

                self.getChildNodes(item, subDirs);
            }
        }

        return subDirs;
    };

    // export
    scope.mega = scope.mega || {};
    scope.mega.Nodes = Nodes;
})(jQuery, window);
