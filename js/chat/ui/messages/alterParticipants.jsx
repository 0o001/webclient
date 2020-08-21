var React = require("react");
var ContactsUI = require('./../contacts.jsx');
var ConversationMessageMixin = require('./mixin.jsx').ConversationMessageMixin;

class AltPartsConvMessage extends ConversationMessageMixin {
    _ensureNameIsLoaded(h) {
        var self = this;
        var contact = M.u[h] ? M.u[h] : {
            'u': h,
            'h': h,
            'c': 0,
        };
        var displayName = generateAvatarMeta(contact.u).fullName;


        if (!displayName) {
            M.u.addChangeListener(function () {
                displayName = generateAvatarMeta(contact.u).fullName;
                if (displayName) {
                    self.safeForceUpdate();

                    return 0xDEAD;
                }
            });
        }
    }
    haveMoreContactListeners() {
        if (!this.props.message || !this.props.message.meta) {
            return false;
        }

        if (this.props.message.meta) {
            if (this.props.message.meta.included) {
                return this.props.message.meta.included;
            }
            else if (this.props.message.meta.excluded) {
                return this.props.message.meta.excluded;
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }
    }
    render() {
        var self = this;

        var message = this.props.message;
        var contact = self.getContact();
        var timestampInt = self.getTimestamp();
        var timestamp = self.getTimestampAsString();



        var datetime = <div className="message date-time simpletip"
            data-simpletip={time2date(timestampInt)}>{timestamp}</div>;

        var displayName;
        if (contact) {
            displayName = generateAvatarMeta(contact.u).fullName;
        }
        else {
            displayName = contact;
        }

        var messages = [];

        message.meta.included.forEach(function(h) {
            var otherContact = M.u[h] ? M.u[h] : {
                'u': h,
                'h': h,
                'c': 0,
            };

            var avatar = <ContactsUI.Avatar contact={otherContact}
                chatRoom={self.props.chatRoom}
                className="message avatar-wrapper small-rounded-avatar"/>;
            var otherDisplayName = generateAvatarMeta(otherContact.u).fullName;

            var text = (h === contact.u) ?
                'joined the group chat.' :
                l[8907].replace(
                    "%s",
                    '<strong className="dark-grey-txt">' + htmlentities(displayName) + '</strong>'
                );

            self._ensureNameIsLoaded(otherContact.u);
            messages.push(
                <div className="message body" data-id={"id" + message.messageId} key={message.messageId + "_" + h}>
                    {avatar}

                    <div className="message content-area small-info-txt">
                        <ContactsUI.ContactButton contact={otherContact} className="message" label={otherDisplayName}
                            chatRoom={self.props.chatRoom}/>
                        {datetime}

                        <div className="message text-block" dangerouslySetInnerHTML={{__html:text}}></div>
                    </div>
                </div>
            );
        });

        message.meta.excluded.forEach(function(h) {
            var otherContact = M.u[h] ? M.u[h] : {
                'u': h,
                'h': h,
                'c': 0,
            };

            var avatar = <ContactsUI.Avatar contact={otherContact}
                chatRoom={self.props.chatRoom}
                className="message avatar-wrapper small-rounded-avatar"/>;
            var otherDisplayName = generateAvatarMeta(otherContact.u).fullName;

            self._ensureNameIsLoaded(otherContact.u);

            var text;
            if (otherContact.u === contact.u) {
                text = l[8908];
            }
            else {
                text = l[8906].replace(
                    "%s",
                    '<strong className="dark-grey-txt">' + htmlentities(displayName) + '</strong>'
                );
            }

            messages.push(
                <div className="message body" data-id={"id" + message.messageId} key={message.messageId + "_" + h}>
                    {avatar}

                    <div className="message content-area small-info-txt">
                        <ContactsUI.ContactButton contact={otherContact} className="message" label={otherDisplayName}
                            chatRoom={self.props.chatRoom} />
                        {datetime}

                        <div className="message text-block" dangerouslySetInnerHTML={{__html:text}}></div>
                    </div>
                </div>
            )
        });

        return <div>{messages}</div>;
    }
};

export {
    AltPartsConvMessage
};
