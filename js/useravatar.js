/**
 *  Handle all logic for rendering for users' avatar
 */

var useravatar = (function() {
    "use strict";
    var _colors = [
        '#FF6A19',
        '#5856d6',
        '#007aff',
        '#34aadc',
        '#5ac8fa',
        '#4cd964',
        '#ff1a53',
        '#d90007',
        '#ff9500',
        '#ffcc00',
    ];

    /**
     *  List of TWO-letters avatars that we ever generated. It's useful to replace
     *  the moment we discover the real avatar associate with that avatar
     */
    var _watching = {};

    /**
     *  Public methods
     */
    var ns = {};

    /**
     *  Take the class colors and create a inject as a CSS.
     */
    var registerCssColors = function() {
        var css = "";
        for (var i in _colors) {
            if (!_colors.hasOwnProperty(i)) {
                continue;
            }
            css += ".color" + (parseInt(i) + 1) + " { background-color: "
                + _colors[i] + "; }";
        }
        css = mObjectURL([css], "text/css");
        mCreateElement('link', {type: 'text/css', rel: 'stylesheet'}, 'head').href = css;
    };

    /**
     * Return a SVG image representing the TWO-Letters avatar
     * @private
     */
    var _lettersImg = function(letters) {
        var s = _lettersSettings(letters);
        var tpl = $('#avatar-svg').clone().removeClass('hidden')
            .find('svg').css('background-color', s.color).end()
            .find('text').text(s.letters).end();

        tpl = window.btoa(unescape(tpl.html()));
        return 'data:image/svg+xml;base64,' + tpl;
    };

    /**
     * Return two letters and the color for a given string
     *
     * @return {string}
     * @private
     */
    var _lettersSettings = function(word) {
        var letters = "";
        var color   = 1;
        if (word && word !== u_handle) {
            // Word is indeed not empty nor our user ID.
            var words = $.trim(word).toUpperCase().split(/\W+/);
            letters = words[0][0];
            color   = letters.charCodeAt(0) % _colors.length;
        }
        return {letters: letters, color: _colors[color], colorIndex: color + 1 };
    };

    /**
     *  Return the HTML to represent a two letter avatar.
     *
     *  @param letters      String used to generate the avatar
     *  @param id           ID associate with the avatar (uid, email)
     *  @param className Any extra CSS classes that we want to append to the HTML
     *
     *  @return HTML
     */
    var _letters = function(letters, id, className, element) {
        if (element === 'ximg') {
            return _lettersImg(letters);
        }
        var s = _lettersSettings(letters);
        if (!_watching[id]) {
            _watching[id] = {};
        }
        _watching[id][className] = true;
        return '<' + element + ' class="avatar-wrapper ' + className + ' ' + id +  ' color' + s.colorIndex + '">'
                    + s.letters
                + '</' + element + '>';
    };

    /**
     *  Return an image HTML from an URL
     *
     *  @param url          Image URL
     *  @param id           ID associate with the avatar (uid)
     *  @param className Any extra CSS classes that we want to append to the HTML
     */
    var _image = function(url, id, className, type) {
        return '<' + type + ' class="avatar-wrapper ' + id + ' ' + className + '">'
                + '<img src="' + url + '">'
         + '</' + type + '>';
    };

    /**
     *  Check if the input is an email address or not.
     */
    function isEmail(email) {
        return typeof email === "string" && email.match(/.+@.+/);
    }

    /**
     *  Like the `contact` method but instead of returning a
     *  div with the avatar inside it returns an image URL.
     */
    ns.imgUrl = function(contact) {
        if (avatars[contact]) {
            return avatars[contact].url;
        }
        return ns.contact(contact, '', 'ximg');
    };

    /**
     *  Return the current user's avatar in image URL.
     */
    ns.top = function() {
        if (!u_handle) {
            /* No user */
            return staticpath + 'images/mega/default-top-avatar.png';
        }
        return ns.imgUrl(u_handle);
    };


    /**
     *  Return the current user's avatar in image URL.
     */
    ns.mine = function() {
        if (!u_handle) {
            /* No user */
            return staticpath + 'images/mega/default-avatar.png';
        }
        return ns.imgUrl(u_handle);
    };

    /**
     *  A new contact has been loaded, let's see if they have any two-letters avatars, if
     *  that is the case we replace that old avatar *everywhere* with their proper avatar
     */
    ns.loaded = function(user) {
        if (typeof user !== "string") {
            return false;
        }

        if (user === u_handle) {
            // my avatar!
            $('.fm-avatar img,.fm-account-avatar img').attr('src', ns.imgUrl(user));
        }

        var avatar = $(ns.contact(user)).html();
        $('.avatar-wrapper.' + user).empty().html(avatar);
        if ((M.u[user] || {}).m) {
            $('.avatar-wrapper.' + M.u[user].m.replace(/[\.@]/g, "\\$1")).empty().html(avatar);
        }
    };

    function emailAvatar(user, className, element)
    {
        var found;
        // User is an email, we should look if the user
        // exists, if it does exists we use the user Object.
        M.u.forEach(function(contact, h) {
            if (contact.m === user) {
                // found the user object
                found = ns.contact(contact, className, element);

                return false;
            }
        });
        if (found) {
            return found;
        }
        else {
            return _letters(user.substr(0, 2), user, className, element);
        }
    }

    ns.contact = function(user, className, element) {
        
        if (!className) {
            className = "avatar";
        }
        element   = element || "div";
        if (typeof user === "string" && user.length > 0) {
            if (isEmail(user)) {
                return emailAvatar(user, className, element);
            }
            else if (M.u[user]) {
                // It's an user ID
                user = M.u[user];
            }
            else {
                return _letters(user, user, className, element);
            }
        }

        if (typeof user !== "object" || !(user||{}).u) {
            return "";
        }

        if (avatars[user.u]) {
            return _image(avatars[user.u].url, user.u, className, element);
        }

        return _letters(user.name || user.m, user.u, className, element);
    };

    registerCssColors();

    return ns;
})();
