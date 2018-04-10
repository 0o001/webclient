/**
 * Functionality for the mobile Cancel Account section
 */
mobile.account.cancel = {

    /**
     * Initialise the page
     */
    init: function() {

        'use strict';

        // Cache selectors
        var $page = $('.mobile.cancel-account');

        // Initialise functionality
        this.initBackButton($page);
        this.initFeedbackRadioButtons($page);
        this.initCancelAccountButton($page);

        // Initialise the top menu
        topmenuUI();

        // Show the account page content
        $page.removeClass('hidden');
    },

    /**
     * Initialise the back arrow icon in the header to go back to the main My Account page
     * @param {String} $page The jQuery selector for the current page
     */
    initBackButton: function($page) {

        'use strict';

        // On Back button click/tap
        $page.find('.fm-icon.back').off('tap').on('tap', function() {

            // Render the Invites page again
            loadSubPage('fm/account/');
            return false;
        });
    },

    /**
     * Initialise the custom radio buttons to appear selected when clicked
     * @param {String} $page The jQuery selector for the current page
     */
    initFeedbackRadioButtons: function($page) {

        'use strict';

        var $allRadioButtons = $page.find('.radio-button-form .radio-option');
        var $allIcons = $allRadioButtons.find('div');
        var $allInputs = $allRadioButtons.find('input');
        var $firstRadioButton = $allRadioButtons.first();

        // Preselect first option
        $firstRadioButton.find('div').removeClass('radioOff').addClass('radioOn');
        $firstRadioButton.find('input').prop('checked', true);

        // On tap of any radio button block
        $allRadioButtons.off('tap').on('tap', function() {

            // Uncheck all radio options
            $allIcons.removeClass('radioOn').addClass('radioOff');
            $allInputs.prop('checked', false);

            // Check just the clicked/tapped radio button
            $(this).find('div').removeClass('radioOff').addClass('radioOn');
            $(this).find('input').prop('checked', true);

            // Prevent double taps
            return false;
        });
    },

    /**
     * Initialise the confirm button to complete the cancellation of the user's account
     * @param {String} $page The jQuery selector for the current page
     */
    initCancelAccountButton: function($page) {

        'use strict';

        // On button tap/click
        $page.find('.confirm-close-account-button').off('tap').on('tap', function() {

            // Get the English text of the selected radio option to send to the server
            var $selectedFeedbackItem = $page.find('.radio-option input:checked');
            var selectedFeedbackText = $selectedFeedbackItem.attr('data-english-log-text');
            var feedbackJson = '{"lang": "' + lang + '", "feedbackText": "' + selectedFeedbackText + '"}';

            // Send feedback log to the server
            api_req({ a: 'clog', t: 'accClosureUserFeedback', d: feedbackJson });

            // Complete the cancellation process
            mobile.account.cancel.completeCancellationProcess();

            // Prevent double taps
            return false;
        });
    },

    /**
     * Completes the cancellation process
     */
    completeCancellationProcess: function() {

        'use strict';

        // Get the email cancellation code and a random password
        var emailCode = page.replace('cancel', '');
        var password = Math.random().toString();

        // Set flag to show a dialog message after cancellation
        localStorage.beingAccountCancellation = 1;

        // Show loading spinner while request completes
        loadingDialog.show();

        // Park the current account, then create a new account with a random password
        api_resetuser({ callback: function(code) {

            loadingDialog.hide();

            // If account was successfully canceled, logout the user and force reload the page
            if (code === 0) {
                u_logout(true);
                location.reload();
            }

            // If the code has expired
            else if (code === EEXPIRED || code === ENOENT) {

                // Delete flag
                delete localStorage.beingAccountCancellation;

                // Show message that the cancellation link has expired and to try again
                mobile.messageOverlay.show(l[6184], l[6185], '', function() {
                    loadSubPage('fm/account');
                });
            }
        }}, emailCode, u_attr.email, password);
    }
};
