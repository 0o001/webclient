var React = require("react");
var ReactDOM = require("react-dom");
import utils  from "./utils.jsx";
import {MegaRenderMixin} from "../stores/mixins.js";
import Tooltips from "./tooltips.jsx";
import Forms from "./forms.jsx";

var ContactsUI = require('./../chat/ui/contacts.jsx');

export class ExtraFooterElement extends MegaRenderMixin {
    render() {
        return this.props.children;
    }
};

class ModalDialog extends MegaRenderMixin {
    static defaultProps = {
        'hideable': true,
        'closeDlgOnClickOverlay': true,
        'showSelectedNum': false,
        'selectedNum': 0
    };

    constructor (props) {
        super(props);
        this.onBlur = this.onBlur.bind(this);
        this.onCloseClicked = this.onCloseClicked.bind(this);
        this.onPopupDidMount = this.onPopupDidMount.bind(this);
    }

    componentDidMount() {
        super.componentDidMount();
        var self = this;
        $(document.body).addClass('overlayed');
        $('.fm-dialog-overlay').removeClass('hidden');

        // blur the chat textarea if its selected.
        $('textarea:focus').trigger("blur");


        var convApp = document.querySelector('.conversationsApp');
        if (convApp) {
            convApp.removeEventListener('click', this.onBlur);
            convApp.addEventListener('click', this.onBlur);
        }


        $('.fm-modal-dialog').rebind('click.modalDialogOv' + this.getUniqueId(), function(e) {
            if ($(e.target).is('.fm-modal-dialog')) {
                self.onBlur();
            }
        });

        $(document).rebind('keyup.modalDialog' + self.getUniqueId(), function(e) {
            if (e.keyCode == 27) { // escape key maps to keycode `27`
                self.onBlur();
            }
        });

        $('.fm-dialog-overlay').rebind('click.modalDialog' + self.getUniqueId(), function() {
            if (self.props.closeDlgOnClickOverlay) {
                self.onBlur();
            }
            return false;
        });
    }
    onBlur(e) {
        var $element = $(this.findDOMNode());

        if (
            (!e || !$(e.target).closest(".fm-dialog").is($element))
        ) {
            var convApp = document.querySelector('.conversationsApp');
            if (convApp) {
                convApp.removeEventListener('click', this.onBlur);
            }
            this.onCloseClicked();
        }
    }
    componentWillUnmount() {
        super.componentWillUnmount();
        var convApp = document.querySelector('.conversationsApp');
        if (convApp) {
            convApp.removeEventListener('click', this.onBlur);
        }
        $(document).off('keyup.modalDialog' + this.getUniqueId());
        $(this.domNode).off('dialog-closed.modalDialog' + this.getUniqueId());
        $(document.body).removeClass('overlayed');
        $('.fm-dialog-overlay').addClass('hidden');
        $('.fm-dialog-overlay').off('click.modalDialog' + this.getUniqueId());
    }
    onCloseClicked() {
        var self = this;

        if (self.props.onClose) {
            self.props.onClose(self);
        }
    }
    onPopupDidMount(elem) {
        this.domNode = elem;

        $(elem).rebind('dialog-closed.modalDialog' + this.getUniqueId(), () => this.onCloseClicked());

        if (this.props.popupDidMount) {
            // bubble up...
            this.props.popupDidMount(elem);
        }
    }
    render() {
        var self = this;

        var classes = "fm-dialog " + self.props.className;

        var selectedNumEle = null;
        var footer = null;

        var extraFooterElements = [];
        var otherElements = [];

        var x = 0;
        React.Children.forEach(self.props.children, function (child) {
            if (!child) {
                // skip if undefined
                return;
            }

            if (
                child.type.name === 'ExtraFooterElement'
            ) {
                extraFooterElements.push(React.cloneElement(child, {
                    key: x++
                }));
            }
            else {
                otherElements.push(
                    React.cloneElement(child, {
                        key: x++
                    })
                );
            }
        }.bind(this));

        if (self.props.showSelectedNum && self.props.selectedNum) {
            selectedNumEle = <div className="selected-num"><span>{self.props.selectedNum}</span></div>;
        }

        if (self.props.buttons) {
            var buttons = [];
            self.props.buttons.forEach(function(v, i) {
                if (v) {
                    buttons.push(
                        <a
                            className={
                                (v.defaultClassname ? v.defaultClassname : "default-white-button right") +
                                (v.className ? " " + v.className : "")
                            }
                            onClick={(e) => {
                                if ($(e.target).is(".disabled")) {
                                    return false;
                                }
                                if (v.onClick) {
                                    v.onClick(e, self);
                                }
                            }} key={v.key + i}>
                            {v.iconBefore ? <i className={v.iconBefore} /> : null}
                            {v.label}
                            {v.iconAfter ? <i className={v.iconAfter} /> : null}
                        </a>
                    );
                }
            });

            footer = <div className="fm-dialog-footer white">
                {extraFooterElements}
                <div className="footer-buttons">
                    {buttons}
                </div>
                <div className="clear"></div>
            </div>;
        }

        return (
            <utils.RenderTo element={document.body} className="fm-modal-dialog" popupDidMount={this.onPopupDidMount}>
                <div className={classes}>
                    <div className="fm-dialog-close" onClick={self.onCloseClicked}></div>
                    {
                        self.props.title ?
                            <div className="fm-dialog-title">{self.props.title}{selectedNumEle}</div> : null
                    }

                    <div className="fm-dialog-content">
                        {otherElements}
                    </div>

                    {footer}
                </div>
            </utils.RenderTo>
        );
    }
};



class SelectContactDialog extends MegaRenderMixin {
    static clickTime = 0;
    static defaultProps = {
        'selectLabel': l[1940],
        'cancelLabel': l[82],
        'hideable': true
    };

    constructor (props) {
        super(props);
        this.state = {
            'selected': this.props.selected ? this.props.selected : []
        };

        this.onSelected = this.onSelected.bind(this);
    }
    onSelected(nodes) {
        this.setState({'selected': nodes});
        if (this.props.onSelected) {
            this.props.onSelected(nodes);
        }
    }
    onSelectClicked() {
        this.props.onSelectClicked();
    }
    render() {
        var self = this;

        var classes = "send-contact contrast small-footer " + self.props.className;

        return (
            <ModalDialog
                title={l[8628]}
                className={classes}
                selected={self.state.selected}
                onClose={() => {
                    self.props.onClose(self);
                }}
                buttons={[
                        {
                            "label": self.props.selectLabel,
                            "key": "select",
                            "defaultClassname": "default-grey-button lato right",
                            "className": self.state.selected.length === 0 ? "disabled" : null,
                            "onClick": function(e) {
                                if (self.state.selected.length > 0) {
                                    if (self.props.onSelected) {
                                        self.props.onSelected(self.state.selected);
                                    }
                                    self.props.onSelectClicked(self.state.selected);
                                }
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        },
                        {
                            "label": self.props.cancelLabel,
                            "key": "cancel",
                            "defaultClassname": "link-button lato left",
                            "onClick": function(e) {
                                self.props.onClose(self);
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        },
            ]}>
            <ContactsUI.ContactPickerWidget
                megaChat={self.props.megaChat}
                exclude={self.props.exclude}
                selectableContacts="true"
                onSelectDone={self.props.onSelectClicked}
                onSelected={self.onSelected}
                selected={self.state.selected}
                contacts={M.u}
                headerClasses="left-aligned"
                multiple={true}
                />
            </ModalDialog>
        );
    }
};

class ConfirmDialog extends MegaRenderMixin {
    static defaultProps = {
        'confirmLabel': l[6826],
        'cancelLabel': l[82],
        'dontShowAgainCheckbox': true,
        'hideable': true
    };

    static saveState(o) {
        let state = mega.config.get('xcod') >>> 0;
        mega.config.set('xcod', state | 1 << o.props.pref);
    }

    static clearState(o) {
        let state = mega.config.get('xcod') >>> 0;
        mega.config.set('xcod', state & ~(1 << o.props.pref));
    }

    static autoConfirm(o) {
        console.assert(o.props.pref > 0);
        let state = mega.config.get('xcod') >>> 0;
        return !!(state & 1 << o.props.pref);
    }

    constructor(props) {
        super(props);
        this._wasAutoConfirmed = undefined;
        this._keyUpEventName = 'keyup.confirmDialog' + this.getUniqueId();

        if (Date.now() < 1616e9) {
            mega.config.remove('xccd');
        }
        else {
            console.error('^ REMOVE ME');
        }

        /** @property this._autoConfirm */
        lazy(this, '_autoConfirm', () =>
            this.props.onConfirmClicked
            && this.props.dontShowAgainCheckbox
            && ConfirmDialog.autoConfirm(this));
    }
    unbindEvents() {
        $(document).off(this._keyUpEventName);
    }
    componentDidMount() {
        super.componentDidMount();

        // since ModalDialogs can be opened in other keyup (on enter) event handlers THIS is required to be delayed a
        // bit...otherwise the dialog would open up and get immediately confirmed
        queueMicrotask(() => {
            if (!this.isMounted()) {
                // can be automatically hidden/unmounted, so this would bind the event AFTER the unbind in
                // componentWillUnmount executed.
                return;
            }

            if (this._autoConfirm) {
                if (!this._wasAutoConfirmed) {
                    this._wasAutoConfirmed = 1;

                    // this would most likely cause a .setState, so it should be done in a separate cycle/call stack.
                    queueMicrotask(() => {
                        this.onConfirmClicked();
                    });
                }

                return;
            }

            $(document).rebind(this._keyUpEventName, (e) => {
                if (e.which === 13 || e.keyCode === 13) {
                    if (!this.isMounted()) {
                        // we need to be 10000% sure that the dialog is still shown, otherwise, we may trigger some
                        // unwanted action.
                        this.unbindEvents();
                        return;
                    }
                    this.onConfirmClicked();
                    return false;
                }
            });
        });
    }
    componentWillUnmount() {
        super.componentWillUnmount();
        var self = this;
        self.unbindEvents();
        delete this._wasAutoConfirmed;
    }

    onConfirmClicked() {
        this.unbindEvents();
        if (this.props.onConfirmClicked) {
            this.props.onConfirmClicked();
        }
    }

    render() {
        var self = this;
        if (this._autoConfirm) {
            return null;
        }

        var classes = "delete-message " + self.props.name + " " + self.props.className;

        var dontShowCheckbox = null;
        if (self.props.dontShowAgainCheckbox) {
            dontShowCheckbox = <div className="footer-checkbox">
                <Forms.Checkbox
                    name="delete-confirm"
                    id="delete-confirm"
                    onLabelClick={(e, state) => {
                        if (state === true) {
                            ConfirmDialog.saveState(self);
                        }
                        else {
                            ConfirmDialog.clearState(self);
                        }
                    }}
                >
                    {l[7039]}
                </Forms.Checkbox>
            </div>;
        }
        return (
            <ModalDialog
                title={this.props.title}
                className={classes}
                onClose={() => {
                    self.props.onClose(self);
                }}
                buttons={[
                        {
                            "label": self.props.confirmLabel,
                            "key": "select",
                            "className": null,
                            "onClick": function(e) {
                                self.onConfirmClicked();
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        },
                        {
                            "label": self.props.cancelLabel,
                            "key": "cancel",
                            "onClick": function(e) {
                            ConfirmDialog.clearState(self);
                                self.props.onClose(self);
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        },
            ]}>
                <div className="fm-dialog-content">
                    {self.props.children}
                </div>
                <ExtraFooterElement>
                    {dontShowCheckbox}
                </ExtraFooterElement>
            </ModalDialog>
        );
    }
};

export default {
    ModalDialog,
    SelectContactDialog,
    ConfirmDialog
};
