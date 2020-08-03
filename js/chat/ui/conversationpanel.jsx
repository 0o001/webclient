import React from 'react';
import ReactDOM from 'react-dom';
import utils from './../../ui/utils.jsx';
import {MegaRenderMixin, timing, SoonFcWrap} from './../../stores/mixins.js';
import {Button} from './../../ui/buttons.jsx';
import ModalDialogsUI from './../../ui/modalDialogs.jsx';
import CloudBrowserModalDialog from './../../ui/cloudBrowserModalDialog.jsx';
import { Dropdown, DropdownItem, DropdownContactsSelector } from './../../ui/dropdowns.jsx';
import { ContactCard, MembersAmount } from './../ui/contacts.jsx';
import { TypingArea } from './../ui/typingArea.jsx';
import { WhosTyping } from './whosTyping.jsx';
import { PerfectScrollbar } from './../../ui/perfectScrollbar.jsx';
import { Accordion } from './../../ui/accordion.jsx';
import { AccordionPanel } from './../../ui/accordion.jsx';
import { ParticipantsList } from './participantsList.jsx';
import GenericConversationMessage  from './messages/generic.jsx';
import { AltPartsConvMessage }  from './messages/alterParticipants.jsx';
import { TruncatedMessage } from './messages/truncated.jsx';
import { PrivilegeChange } from './messages/privilegeChange.jsx';
import { TopicChange } from './messages/topicChange.jsx';
import { SharedFilesAccordionPanel } from './sharedFilesAccordionPanel.jsx';
import { IncSharesAccordionPanel } from './incomingSharesAccordionPanel.jsx';
import { CloseOpenModeMessage } from './messages/closeOpenMode.jsx';
import { ChatHandleMessage } from './messages/chatHandle.jsx';
import { ChatlinkDialog } from './../ui/chatlinkDialog.jsx';
import { ConversationAVPanel } from './conversationaudiovideopanel.jsx';

var ENABLE_GROUP_CALLING_FLAG = true;

// eslint-disable-next-line id-length
var MAX_USERS_CHAT_PRIVATE = 100;

export class JoinCallNotification extends MegaRenderMixin {
    componentDidUpdate() {
        var $node = $(this.findDOMNode());
        var room = this.props.chatRoom;
        $('a.joinActiveCall', $node)
            .rebind('click.joinCall', function(e) {
                room.joinCall();
                e.preventDefault();
                return false;
            });
    }
    render() {
        var room = this.props.chatRoom;
        if (room.getCallParticipants().length >= RtcModule.kMaxCallReceivers) {
            return <div className="in-call-notif yellow join">
                <i className="small-icon audio-call colorized"/>
                {l[20200]}
            </div>;
        }
        else {
            var translatedCode = escapeHTML(l[20460] || "There is an active group call. [A]Join[/A]");
            translatedCode = translatedCode
                .replace("[A]", '<a class="joinActiveCall">')
                .replace('[/A]', '</a>');

            return <div className="in-call-notif neutral join">
                <i className="small-icon audio-call colorized"/>
                <span dangerouslySetInnerHTML={{__html: translatedCode}}></span>
            </div>;
        }
    }
};

export class ConversationRightArea extends MegaRenderMixin {
    static defaultProps = {
        'requiresUpdateOnResize': true
    }
    customIsEventuallyVisible() {
        return this.props.chatRoom.isCurrentlyActive;
    }
    allContactsInChat(participants) {
        var self = this;
        if (participants.length === 0) {
            return false;
        }

        var currentContacts = M.u.keys();
        for (var i = 0; i < currentContacts.length; i++) {
            var k = currentContacts[i];
            if (M.u[k].c === 1 && participants.indexOf(k) === -1) {
                return false;
            }
        }
        return true;
    }
    render() {
        const self = this;
        const { chatRoom: room } = self.props;

        if (!room || !room.roomId) {
            // destroyed
            return null;
        }

        // room is not active, don't waste DOM nodes, CPU and Memory (and save some avatar loading calls...)
        if (!room.isCurrentlyActive && !self._wasAppendedEvenOnce) {
            return null;
        }
        self._wasAppendedEvenOnce = true;

        var startCallDisabled = isStartCallDisabled(room);
        var startCallButtonClass = startCallDisabled ? " disabled" : "";
        var startAudioCallButton;
        var startVideoCallButton;
        var endCallButton;

        var isInCall = !!room.callManagerCall && room.callManagerCall.isActive();
        if (isInCall) {
            startAudioCallButton = startVideoCallButton = null;
        } else {
            endCallButton = null;
        }

        if (room.type === "group" || room.type === "public") {
            if (!ENABLE_GROUP_CALLING_FLAG ||
                ((room.getCallParticipants().length > 0) && !isInCall)
            ){
                // call is active, but I'm not in
                startAudioCallButton = startVideoCallButton = null;
            }
        }

        if (startAudioCallButton !== null) {
            startAudioCallButton =
                <div className={"link-button light" + startCallButtonClass} onClick={() => {
                    if (!startCallDisabled) {
                        room.startAudioCall();
                    }
                }}>
                <i className="small-icon colorized audio-call"></i>
                <span>{__(l[5896])}</span>
            </div>;
        }
        if (startVideoCallButton !== null) {
            startVideoCallButton =
                <div className={"link-button light" + startCallButtonClass} onClick={() => {
                    if (!startCallDisabled) {
                        room.startVideoCall();
                    }
                }}>
                <i className="small-icon colorized video-call"></i>
                <span>{__(l[5897])}</span>
            </div>;
        }
        var AVseperator = <div className="chat-button-seperator"></div>;
        if (endCallButton !== null) {
            endCallButton =
                <div className={"link-button light red"} onClick={() => {
                    if (room.callManagerCall) {
                        room.callManagerCall.endCall();
                    }
                }}>
                <i className="small-icon colorized horizontal-red-handset"></i>
                <span>{room.type === "group" || room.type === "public" ? "Leave call" : l[5884]}</span>
            </div>;
        }
        var isReadOnlyElement = null;

        if (room.isReadOnly()) {
            isReadOnlyElement = <center className="center" style={{margin: "6px"}}>(read only chat)</center>;
        }
        var excludedParticipants = room.type === "group" || room.type === "public" ?
            (
                room.members && Object.keys(room.members).length > 0 ? Object.keys(room.members) :
                    room.getParticipants()
            )   :
            room.getParticipants();

        if (excludedParticipants.indexOf(u_handle) >= 0) {
            array.remove(excludedParticipants, u_handle, false);
        }
        var dontShowTruncateButton = false;
        if (
            !room.iAmOperator() ||
            room.isReadOnly() ||
            room.messagesBuff.messages.length === 0 ||
            (
                room.messagesBuff.messages.length === 1 &&
                room.messagesBuff.messages.getItem(0).dialogType === "truncated"
            )
        ) {
            dontShowTruncateButton = true;
        }


        // console.error(
        //     self.findDOMNode(),
        //     excludedParticipants,
        //         self.allContactsInChat(excludedParticipants),
        //         room.isReadOnly(),
        //         room.iAmOperator(),
        //     myPresence === 'offline'
        // );

        var renameButtonClass = "link-button light " + (
            room.isReadOnly() || !room.iAmOperator() ?
                "disabled" : ""
            );

        let participantsList = null;
        if (room.type === "group" || room.type === "public") {
            participantsList = (
                <div>
                    {isReadOnlyElement}
                    <ParticipantsList
                        ref={function(r) {
                            self.participantsListRef = r;
                        }}
                        chatRoom={room}
                        members={room.members}
                        isCurrentlyActive={room.isCurrentlyActive}
                    />
                </div>
            );
        }

        const addParticipantBtn = (
                <Button
                    className="link-button green light"
                    icon="rounded-plus colorized"
                    label={__(l[8007])}
                    disabled={
                        /* Disable in case I don't have any more contacts to add ... */
                        !(
                            !room.isReadOnly() &&
                            room.iAmOperator() &&
                            !self.allContactsInChat(excludedParticipants)
                        )
                    }
                >
                    <DropdownContactsSelector
                        contacts={this.props.contacts}
                        chatRoom={room}
                        exclude={
                            excludedParticipants
                        }
                        multiple={true}
                        className="popup add-participant-selector"
                        singleSelectedButtonLabel={__(l[8869])}
                        multipleSelectedButtonLabel={__(l[8869])}
                        nothingSelectedButtonLabel={__(l[8870])}
                        onSelectDone={this.props.onAddParticipantSelected.bind(this)}
                        positionMy="center top"
                        positionAt="left bottom"
                        arrowHeight={-32}
                        selectFooter={true}
                    />
                </Button>
        );

        var expandedPanel = {};
        if (room.type === "group" || room.type === "public") {
            expandedPanel['participants'] = true;
        }
        else {
            expandedPanel['options'] = true;
        }

        return <div className="chat-right-area">
            <PerfectScrollbar
                className="chat-right-area conversation-details-scroll"
                options={{
                    'suppressScrollX': true
                }}
                ref={function(ref) {
                    self.rightScroll = ref;
                }}
                triggerGlobalResize={true}
                isVisible={self.props.chatRoom.isCurrentlyActive}
                chatRoom={self.props.chatRoom}>
                <div className="chat-right-pad">
                    <Accordion
                        chatRoom={room}
                        onToggle={SoonFc(20, function() {
                            // wait for animations.
                            if (self.rightScroll) {
                                self.rightScroll.reinitialise();
                            }
                            if (self.participantsListRef) {
                                self.participantsListRef.safeForceUpdate();
                            }
                        })}
                        expandedPanel={expandedPanel}
                    >
                        {participantsList ? <AccordionPanel className="small-pad" title={l[8876]}
                            chatRoom={room} key="participants">
                            {participantsList}
                        </AccordionPanel> : null}
                        {room.type === "public" && room.observers > 0 ? <div className="accordion-text observers">
                            {l[20466]}
                            <span className="observers-count">
                                <i className="tiny-icon eye"></i>
                                {room.observers}
                            </span>
                        </div> : <div></div>}

                        <AccordionPanel className="have-animation buttons" title={l[7537]} key="options"
                            chatRoom={room}>
                            <div>
                            {addParticipantBtn}
                            {startAudioCallButton}
                            {startVideoCallButton}
                            {AVseperator}
                            {
                                room.type == "group" || room.type == "public" ?
                                (
                                    <div className={renameButtonClass}
                                         onClick={(e) => {
                                             if ($(e.target).closest('.disabled').length > 0) {
                                                 return false;
                                             }
                                             if (self.props.onRenameClicked) {
                                                self.props.onRenameClicked();
                                             }
                                    }}>
                                        <i className="small-icon colorized writing-pen"></i>
                                        <span>{l[9080]}</span>
                                    </div>
                                ) : null
                            }
                            {
                                (!room.isReadOnly() && (room.type === "public")) ?
                                    (
                                        <div className="link-button light"
                                             onClick={(e) => {
                                                 if ($(e.target).closest('.disabled').length > 0) {
                                                     return false;
                                                 }

                                                 self.props.onGetManageChatLinkClicked();
                                             }}>
                                            <i className="small-icon blue-chain colorized"></i>
                                            <span>{l[20481]}</span>
                                        </div>
                                    ) : null
                            }
                            {
                                !room.membersSetFromApi.members.hasOwnProperty(u_handle) &&
                                room.type === "public" && !anonymouschat &&
                                room.publicChatHandle && room.publicChatKey ?
                                    (
                                        <div className="link-button light"
                                             onClick={(e) => {
                                                 if ($(e.target).closest('.disabled').length > 0) {
                                                     return false;
                                                 }

                                                 self.props.onJoinViaPublicLinkClicked();
                                             }}>
                                            <i className="small-icon writing-pen"></i>
                                            <span>{l[20597]}</span>
                                        </div>
                                    ) : null
                            }

                            <Button
                                className="link-button light dropdown-element"
                                icon="rounded-grey-up-arrow colorized"
                                label={__(l[6834] + "...")}
                                disabled={room.isReadOnly()}
                                >
                                <Dropdown
                                    className="wide-dropdown send-files-selector light"
                                    noArrow="true"
                                    vertOffset={4}
                                    onClick={() => {}}
                                >
                                    <div className="dropdown info-txt">
                                        {__(l[19793]) ? __(l[19793]) : "Send files from..."}
                                    </div>
                                    <DropdownItem
                                        className="link-button light"
                                        icon="grey-cloud colorized"
                                        label={__(l[19794]) ? __(l[19794]) : "My Cloud Drive"}
                                        onClick={() => {
                                            self.props.onAttachFromCloudClicked();
                                        }} />
                                    <DropdownItem
                                        className="link-button light"
                                        icon="grey-computer colorized"
                                        label={__(l[19795]) ? __(l[19795]) : "My computer"}
                                        onClick={() => {
                                            self.props.onAttachFromComputerClicked();
                                        }} />
                                </Dropdown>
                            </Button>

                            {endCallButton}

                            <div className={"link-button light " + (
                                dontShowTruncateButton || !room.members.hasOwnProperty(u_handle) ? "disabled" : "")
                            }
                                 onClick={(e) => {
                                     if ($(e.target).closest('.disabled').length > 0) {
                                         return false;
                                     }
                                     if (self.props.onTruncateClicked) {
                                         self.props.onTruncateClicked();
                                     }
                                 }}>
                                <i className="small-icon colorized clear-arrow"></i>
                                <span>{__(l[8871])}</span>
                            </div>

                            {
                                (room.iAmOperator() && (room.type === "public")) ?
                                    (
                                        <div className="chat-enable-key-rotation-paragraph">
                                            <div className="chat-button-seperator"></div>
                                            <div className={
                                                "link-button light " +
                                                (Object.keys(room.members).length > MAX_USERS_CHAT_PRIVATE ?
                                                    " disabled" : "")
                                            }
                                            onClick={(e) => {
                                                if (
                                                    Object.keys(room.members).length >
                                                    MAX_USERS_CHAT_PRIVATE ||
                                                    $(e.target).closest('.disabled').length > 0
                                                ) {
                                                    return false;
                                                }
                                                self.props.onMakePrivateClicked();
                                            }}>
                                                <i className="small-icon yellow-key colorized"></i>
                                                <span>{l[20623]}</span>
                                            </div>
                                            <p>
                                                <span>{l[20454]}</span>
                                            </p>
                                        </div>
                                    ) : null
                            }

                            <div className="chat-button-seperator"></div>
                            {
                                <div className={"link-button light" + (
                                    !(
                                        (
                                            room.members.hasOwnProperty(u_handle) ||
                                            room.state === ChatRoom.STATE.LEFT
                                        ) &&
                                        !anonymouschat
                                    ) ? " disabled" : ""
                                )}
                                     onClick={(e) => {
                                         if ($(e.target).closest('.disabled').length > 0) {
                                             return false;
                                         }
                                         if (room.isArchived()) {
                                             if (self.props.onUnarchiveClicked) {
                                                 self.props.onUnarchiveClicked();
                                             }
                                         } else {
                                             if (self.props.onArchiveClicked) {
                                                 self.props.onArchiveClicked();
                                             }
                                         }
                                     }}>
                                    <i className={"small-icon colorized " +  ((room.isArchived()) ?
                                        "unarchive" : "archive")}></i>
                                    <span>{room.isArchived() ? __(l[19065]) : __(l[16689])}</span>
                                </div>
                            }
                            {
                                room.type !== "private" ? (
                                <div className={"link-button light red " + (
                                        (
                                            room.type !== "private" && !anonymouschat &&
                                            room.membersSetFromApi.members.hasOwnProperty(u_handle) &&
                                            room.membersSetFromApi.members[u_handle] !== -1
                                        ) ? "" : "disabled"
                                    )}
                                    onClick={(e) => {
                                         if ($(e.target).closest('.disabled').length > 0) {
                                             return false;
                                         }
                                         if (self.props.onLeaveClicked) {
                                             self.props.onLeaveClicked();
                                         }
                                     }}>
                                    <i className="small-icon rounded-stop colorized"></i>
                                    <span>{l[8633]}</span>
                                </div>) : null
                            }
                            {
                                room._closing !== true && room.type === "public" &&
                                !anonymouschat && (
                                    !room.membersSetFromApi.members.hasOwnProperty(u_handle) ||
                                    room.membersSetFromApi.members[u_handle] === -1
                                ) ? (
                                    <div className="link-button light red" onClick={() => {
                                        if (self.props.onCloseClicked) {
                                            self.props.onCloseClicked();
                                        }
                                    }}>
                                        <i className="small-icon rounded-stop colorized"></i>
                                        <span>{l[148]}</span>
                                    </div>
                                ) : null
                                }
                            </div>
                        </AccordionPanel>
                        <SharedFilesAccordionPanel key="sharedFiles" title={l[19796] ? l[19796] : "Shared Files"} chatRoom={room}
                                                   sharedFiles={room.messagesBuff.sharedFiles} />
                        {room.type === "private" ?
                            <IncSharesAccordionPanel key="incomingShares" title={l[5542]} chatRoom={room} /> :
                            null
                        }
                    </Accordion>
                </div>
            </PerfectScrollbar>
        </div>;
    }
}

export class ConversationPanel extends MegaRenderMixin {
    constructor(props) {
        super(props);
        this.state = {
            startCallPopupIsActive: false,
            localVideoIsMinimized: false,
            isFullscreenModeEnabled: false,
            mouseOverDuringCall: false,
            attachCloudDialog: false,
            messagesToggledInCall: false,
            sendContactDialog: false,
            confirmDeleteDialog: false,
            pasteImageConfirmDialog: false,
            nonLoggedInJoinChatDialog: false,
            messageToBeDeleted: null,
            editing: false
        };

        this.handleKeyDown = SoonFc(120, (ev) => this._handleKeyDown(ev));
        this.handleWindowResize = SoonFc(80, (ev) => this._handleWindowResize(ev));
    }
    customIsEventuallyVisible() {
        return this.props.chatRoom.isCurrentlyActive;
    }
    uploadFromComputer() {
        this.props.chatRoom.scrolledToBottom = true;

        this.props.chatRoom.uploadFromComputer();
    }
    refreshUI() {
        if (this.isComponentEventuallyVisible()) {
            const room = this.props.chatRoom;

            room.renderContactTree();
            room.megaChat.refreshConversations();
            room.trigger('RefreshUI');
        }
    }

    @utils.SoonFcWrap(360)
    onMouseMove() {
        if (this.isComponentEventuallyVisible()) {
            this.props.chatRoom.trigger("onChatIsFocused");
        }
    }

    _handleKeyDown() {
        if (this.__isMounted) {
            const chatRoom = this.props.chatRoom;
            if (chatRoom.isActive() && !chatRoom.isReadOnly()) {
                chatRoom.trigger("onChatIsFocused");
            }
        }
    }

    componentDidMount() {
        super.componentDidMount();
        var self = this;
        window.addEventListener('resize', self.handleWindowResize);
        window.addEventListener('keydown', self.handleKeyDown);

        self.props.chatRoom.rebind('call-ended.jspHistory call-declined.jspHistory', function (e, eventData) {
            self.callJustEnded = true;
        });

        self.props.chatRoom.rebind('onSendMessage.scrollToBottom', function (e, eventData) {
            self.props.chatRoom.scrolledToBottom = true;
            if (self.messagesListScrollable) {
                self.messagesListScrollable.scrollToBottom();
            }
        });
        self.props.chatRoom.rebind('openSendFilesDialog.cpanel', function(e) {
            self.setState({'attachCloudDialog': true});
        });
        self.props.chatRoom.rebind('showGetChatLinkDialog.ui', function (e, eventData) {
            createTimeoutPromise(function() {
                return self.props.chatRoom.topic && self.props.chatRoom.state === ChatRoom.STATE.READY;
            }, 350, 15000)
                .always(function() {
                    if (self.props.chatRoom.isCurrentlyActive) {
                        self.setState({
                            'chatLinkDialog': true
                        });
                    }
                    else {
                        // not visible anymore, proceed w/ generating a link silently.
                        self.props.chatRoom.updatePublicHandle();
                    }
                });
        });

        if (self.props.chatRoom.type === "private") {
            var otherContactHash = self.props.chatRoom.getParticipantsExceptMe()[0];
            if (M.u[otherContactHash]) {
                self._privateChangeListener = M.u[otherContactHash].addChangeListener(function() {
                    if (!self.isMounted()) {
                        // theoretical chance of leaking - M.u[...] removed before the listener is removed
                        return 0xDEAD;
                    }
                    self.safeForceUpdate();
                });
            }
        }

        self.eventuallyInit();
        if (anonymouschat) {
            setTimeout(function() {
                self.setState({'nonLoggedInJoinChatDialog': true});
            }, rand_range(5, 10) * 1000);
        }
        self.props.chatRoom._uiIsMounted = true;
        self.props.chatRoom.$rConversationPanel = self;

        self.props.chatRoom.trigger("onComponentDidMount");
    }
    eventuallyInit(doResize) {
        var self = this;

        // because..JSP would hijack some DOM elements, we need to wait with this...
        if (self.initialised) {
            return;
        }
        var $container = $(self.findDOMNode());

        if ($container.length > 0) {
            self.initialised = true;
        }
        else {
            return;
        }

        $(self.findDOMNode()).rebind('resized.convpanel', function() {
            self.handleWindowResize();
        });

        self.$messages = $('.messages.scroll-area > .perfectScrollbarContainer', $container);


        var droppableConfig = {
            tolerance: 'pointer',
            drop: function(e, ui)
            {
                $.doDD(e,ui,'drop',1);
            },
            over: function (e, ui)
            {
                $.doDD(e,ui,'over',1);
            },
            out: function (e, ui)
            {
                $.doDD(e,ui,'out',1);
            }
        };

        self.$messages.droppable(droppableConfig);

        self.lastScrollPosition = null;
        self.props.chatRoom.scrolledToBottom = true;
        self.lastScrollHeight = 0;
        self.lastUpdatedScrollHeight = 0;

        var room = self.props.chatRoom;

        // collapse on ESC pressed (exited fullscreen)
        $(document)
            .rebind("fullscreenchange.megaChat_" + room.roomId, function() {
                if (self.isComponentEventuallyVisible()) {
                    self.setState({isFullscreenModeEnabled: !!$(document).fullScreen()});
                    self.forceUpdate();
                }
            });

        if (doResize !== false) {
            self.handleWindowResize();
        }

        // var ns = ".convPanel";
        // $container
        //     .rebind('animationend' + ns +' webkitAnimationEnd' + ns + ' oAnimationEnd' + ns, function(e) {
        //         self.safeForceUpdate(true);
        //         $.tresizer();
        //     });
    }
    componentWillMount() {
        var self = this;
        var chatRoom = self.props.chatRoom;

        chatRoom.rebind('onHistoryDecrypted.cp', function() {
            self.eventuallyUpdate();
        });

        this._messagesBuffChangeHandler = chatRoom.messagesBuff.addChangeListener(function() {
            // wait for scrolling (if such is happening at the moment) to finish
            Soon(function() {
                if (self.isComponentEventuallyVisible()) {
                    $('.js-messages-scroll-area', self.findDOMNode()).trigger('forceResize', [true]);
                }
            });
        });


    }
    componentWillUnmount() {
        super.componentWillUnmount();
        var self = this;
        var chatRoom = self.props.chatRoom;

        chatRoom._uiIsMounted = true;
        if (this._messagesBuffChangeHandler) {
            chatRoom.messagesBuff.removeChangeListener(this._messagesBuffChangeHandler);
            delete this._messagesBuffChangeHandler;
        }
        if (this._privateChangeListener) {
            var otherContactHash = self.props.chatRoom.getParticipantsExceptMe()[0];
            if (M.u[otherContactHash]) {
                M.u[otherContactHash].removeChangeListener(this._privateChangeListener);
                delete this._privateChangeListener;
            }
        }

        window.removeEventListener('resize', self.handleWindowResize);
        window.removeEventListener('keydown', self.handleKeyDown);
        $(document).off("fullscreenchange.megaChat_" + chatRoom.roomId);
    }
    componentDidUpdate(prevProps, prevState) {
        var self = this;
        var room = this.props.chatRoom;

        self.eventuallyInit(false);

        room.megaChat.updateSectionUnreadCount();

        var domNode = self.findDOMNode();
        var jml = domNode && domNode.querySelector('.js-messages-loading');

        if (jml) {
            if (self.loadingShown) {
                jml.classList.remove('hidden');
            }
            else {
                jml.classList.add('hidden');
            }
        }
        self.handleWindowResize();

        if (prevState.messagesToggledInCall !== self.state.messagesToggledInCall || self.callJustEnded) {
            if (self.callJustEnded) {
                self.callJustEnded = false;
            }
            self.$messages.trigger('forceResize', [
                true,
                1
            ]);
            Soon(function() {
                self.messagesListScrollable.scrollToBottom(true);
            });
        }

        if (prevProps.isActive === false && self.props.isActive === true) {
            var $typeArea = $('.messages-textarea:visible:first', domNode);
            if ($typeArea.length === 1) {
                $typeArea.trigger("focus");
                moveCursortoToEnd($typeArea[0]);
            }
        }
        if (!prevState.renameDialog && self.state.renameDialog === true) {
            Soon(function() {
                var $input = $('.chat-rename-dialog input');
                if ($input && $input[0] && !$($input[0]).is(":focus")) {
                    $input.trigger("focus");
                    $input[0].selectionStart = 0;
                    $input[0].selectionEnd = $input.val().length;
                }
            });
        }

        if (prevState.editing === false && self.state.editing !== false) {
            if (self.messagesListScrollable) {
                self.messagesListScrollable.reinitialise(false);
                // wait for the reinit...
                Soon(function() {
                    if (self.editDomElement && self.editDomElement.length === 1) {
                        self.messagesListScrollable.scrollToElement(self.editDomElement[0], false);
                    }
                });
            }
        }

        if (self.$messages && self.isComponentEventuallyVisible()) {
            $(window).rebind('pastedimage.chatRoom', function(e, blob, fileName) {
                if (self.$messages && self.isComponentEventuallyVisible()) {
                    self.setState({'pasteImageConfirmDialog': [blob, fileName, URL.createObjectURL(blob)]});
                    e.preventDefault();
                }
            });
            self.props.chatRoom.trigger("onComponentDidUpdate");
        }

        if (self._reposOnUpdate !== undefined) {
            var ps = self.messagesListScrollable;
            ps.__prevPosY = ps.getScrollHeight() - self._reposOnUpdate + self.lastScrollPosition;
            ps.scrollToY(ps.__prevPosY, true);
        }
    }

    _handleWindowResize(e, scrollToBottom) {
        if (!M.chat) {
            return;
        }
        if (!this.isMounted()) {
            // not mounted? remove.
            this.componentWillUnmount();
            return;
        }

        if (!this.isComponentEventuallyVisible()) {
            return;
        }

        var $container = $(ReactDOM.findDOMNode(this));
        var self = this;

        self.eventuallyInit(false);

        if (!self.$messages) {
            return;
        }

        // Important. Please ensure we have correct height detection for Chat messages block.
        // We need to check ".fm-chat-input-scroll" instead of ".fm-chat-line-block" height
        var scrollBlockHeight = (
            $('.chat-content-block', $container).outerHeight() -
            ($('.chat-topic-block', $container).outerHeight() || 0) -
            ($('.call-block', $container).outerHeight() || 0) -
            (
                (anonymouschat) ? $('.join-chat-block', $container).outerHeight() :
                $('.chat-textarea-block', $container).outerHeight()
            )
        );

        if (scrollBlockHeight != self.$messages.outerHeight()) {
            self.$messages.css('height', scrollBlockHeight);
            $('.messages.main-pad', self.$messages).css('min-height', scrollBlockHeight);
            self.refreshUI(true);
            if (self.props.chatRoom.callManagerCall) {
                $('.messages-block', $container).height(
                    scrollBlockHeight + $('.chat-textarea-block', $container).outerHeight()
                );
            }
            else {
                $('.messages-block', $container).height('');
            }
        }
        else {
            self.refreshUI(scrollToBottom);
        }
    }
    isActive() {
        return document.hasFocus() && this.$messages && this.$messages.is(":visible");
    }

    @utils.SoonFcWrap(50)
    onMessagesScrollReinitialise(
                            ps,
                            $elem,
                            forced,
                            scrollPositionYPerc,
                            scrollToElement
                ) {
        var self = this;
        var chatRoom = self.props.chatRoom;
        var mb = chatRoom.messagesBuff;

        // don't do anything if history is being retrieved at the moment.
        if (self.scrollPullHistoryRetrieval || mb.isRetrievingHistory) {
            return;
        }

        if (forced) {
            if (!scrollPositionYPerc && !scrollToElement) {
                if (self.props.chatRoom.scrolledToBottom && !self.editDomElement) {
                    // wait for the DOM update, if such.
                    ps.scrollToBottom(true);
                    return true;
                }
            }
            else {
                // don't do anything if the UI was forced to scroll to a specific pos.
                return;
            }
        }

        if (self.isComponentEventuallyVisible()
            && !self.editDomElement && !self.props.chatRoom.isScrollingToMessageId) {

            if (self.props.chatRoom.scrolledToBottom) {
                ps.scrollToBottom(true);
                return true;
            }

            if (self.lastScrollPosition && self.lastScrollPosition !== ps.getScrollPositionY()) {
                ps.scrollToY(self.lastScrollPosition, true);
                return true;
            }
        }
    }

    onMessagesScrollUserScroll(ps) {
        var self = this;

        var scrollPositionY = ps.getScrollPositionY();
        var isAtTop = ps.isAtTop();
        var chatRoom = self.props.chatRoom;
        var mb = chatRoom.messagesBuff;

        if (mb.messages.length === 0) {
            self.props.chatRoom.scrolledToBottom = true;
            return;
        }

        // console.error(self.getUniqueId(), "is user scroll!");

        // turn on/off auto scroll to bottom.
        if (ps.isCloseToBottom(30) === true) {
            if (!self.props.chatRoom.scrolledToBottom) {
                mb.detachMessages();
            }
            self.props.chatRoom.scrolledToBottom = true;
        }
        else {
            self.props.chatRoom.scrolledToBottom = false;
        }

        if (!self.scrollPullHistoryRetrieval && !mb.isRetrievingHistory
            && (isAtTop || scrollPositionY < 5 && ps.getScrollHeight() > 500)
            && mb.haveMoreHistory()) {

            ps.disable();
            self.scrollPullHistoryRetrieval = true;
            self.lastScrollPosition = scrollPositionY;

            let msgAppended = 0;
            const scrYOffset = ps.getScrollHeight();

            chatRoom.one('onMessagesBuffAppend.pull', function() {
                msgAppended++;
            });

            chatRoom.off('onHistoryDecrypted.pull');
            chatRoom.one('onHistoryDecrypted.pull', function() {
                chatRoom.off('onMessagesBuffAppend.pull');

                // wait for all msgs to be rendered.
                chatRoom.messagesBuff.addChangeListener(function() {
                    if (msgAppended > 0) {
                        self._reposOnUpdate = scrYOffset;
                    }

                    self.scrollPullHistoryRetrieval = -1;
                    // self.eventuallyUpdate();

                    return 0xDEAD;
                });
            });

            mb.retrieveChatHistory();
        }

        if (self.lastScrollPosition !== scrollPositionY) {
            self.lastScrollPosition = scrollPositionY;
        }
    }

    isLoading() {
        const chatRoom = this.props.chatRoom;
        const mb = chatRoom.messagesBuff;

        return this.scrollPullHistoryRetrieval === true
            || chatRoom.activeSearches || mb.messagesHistoryIsLoading()
            || mb.joined === false || mb.isDecrypting;
    }

    specShouldComponentUpdate() {
        return !this.loadingShown && this.isComponentEventuallyVisible();
    }

    @SoonFcWrap(450, true)
    enableScrollbar() {
        const ps = this.messagesListScrollable;

        ps.enable();
        this._reposOnUpdate = undefined;
        this.lastScrollPosition = ps.__prevPosY | 0;
    }

    @timing(0.7, 9)
    render() {
        var self = this;

        var room = this.props.chatRoom;
        if (!room || !room.roomId) {
            return null;
        }
        // room is not active, don't waste DOM nodes, CPU and Memory (and save some avatar loading calls...)
        if (!room.isCurrentlyActive && !self._wasAppendedEvenOnce) {
            return null;
        }
        self._wasAppendedEvenOnce = true;

        var contacts = room.getParticipantsExceptMe();
        var contactHandle;
        var contact;
        var avatarMeta;
        var contactName = "";
        if (contacts && contacts.length === 1) {
            contactHandle = contacts[0];
            contact = M.u[contactHandle];
            avatarMeta = contact ? generateAvatarMeta(contact.u) : {};
            contactName = avatarMeta.fullName;
        }
        else if (contacts && contacts.length > 1) {
            contactName = room.getRoomTitle(true);
        }

        var conversationPanelClasses = "conversation-panel " + (room.type === "public" ? "group-chat " : "") +
            room.type + "-chat";

        if (!room.isCurrentlyActive) {
            conversationPanelClasses += " hidden";
        }

        var topicBlockClass = "chat-topic-block";
        if (room.type !== "public") {
            topicBlockClass += " privateChat";
        }
        var messagesList = [];

        if (this.isLoading()) {
            self.loadingShown = true;
        }
        else {
            const mb = room.messagesBuff;

            if (this.scrollPullHistoryRetrieval < 0) {
                this.scrollPullHistoryRetrieval = false;
                self.enableScrollbar();
            }
            delete self.loadingShown;

            if (mb.joined === true && !self.scrollPullHistoryRetrieval && mb.haveMoreHistory() === false) {
                var headerText = l[8002];

                if (contactName) {
                    headerText = headerText.replace("%s", "<span>" + htmlentities(contactName) + "</span>");
                }
                else {
                    headerText = megaChat.plugins.emoticonsFilter.processHtmlMessage(htmlentities(room.getRoomTitle()));
                }

                messagesList.push(
                    <div className="messages notification" key="initialMsg">
                        <div className="header" dangerouslySetInnerHTML={{__html: headerText}}>
                        </div>
                        <div className="info">
                            {__(l[8080])}
                            <p>
                                <i className="semi-big-icon grey-lock"></i>
                                <span dangerouslySetInnerHTML={{
                                    __html: __(l[8540])
                                        .replace("[S]", "<strong>")
                                        .replace("[/S]", "</strong>")
                                }}></span>
                            </p>
                            <p>
                                <i className="semi-big-icon grey-tick"></i>
                                <span dangerouslySetInnerHTML={{
                                    __html: __(l[8539])
                                        .replace("[S]", "<strong>")
                                        .replace("[/S]", "</strong>")
                                }}></span>
                            </p>
                        </div>
                    </div>
                );
            }
        }

        var lastTimeMarker;
        var lastMessageFrom = null;
        var lastGroupedMessageTimeStamp = null;
        var lastMessageState = null;
        var grouped = false;

        room.messagesBuff.messages.forEach(function (v, k) {
            if (!v.protocol && v.revoked !== true) {
                var shouldRender = true;
                if (
                    (
                        v.isManagement &&
                        v.isManagement() === true &&
                        v.isRenderableManagement() === false
                    ) ||
                    v.deleted === true
                ) {
                    shouldRender = false;
                }

                var timestamp = v.delay;
                var curTimeMarker = getTimeMarker(timestamp);
                var currentState = v.getState ? v.getState() : null;

                if (shouldRender === true && curTimeMarker && lastTimeMarker !== curTimeMarker) {
                    lastTimeMarker = curTimeMarker;
                    messagesList.push(
                        <div className="message date-divider" key={v.messageId + "_marker"}
                             title={time2date(timestamp)}>{curTimeMarker}</div>
                    );

                    grouped = false;
                    lastMessageFrom = null;
                    lastGroupedMessageTimeStamp = null;
                    lastMessageState = false;
                }


                if (shouldRender === true) {
                    var userId = v.userId;
                    if (!userId) {
                        // dialogMessage have .authorContact instead of .userId
                        if (contact && contact.u) {
                            userId = contact.u;
                        }
                    }

                    if (v instanceof Message && v.dialogType !== "truncated") {

                        // the grouping logic for messages.
                        if (!lastMessageFrom || (userId && lastMessageFrom === userId)) {
                            if (timestamp - lastGroupedMessageTimeStamp < (5 * 60)) {
                                grouped = true;
                            } else {
                                grouped = false;
                                lastMessageFrom = userId;
                                lastGroupedMessageTimeStamp = timestamp;
                                lastMessageState = currentState;
                            }
                        } else {
                            grouped = false;
                            lastMessageFrom = userId;
                            if (lastMessageFrom === userId) {
                                lastGroupedMessageTimeStamp = timestamp;
                            } else {
                                lastGroupedMessageTimeStamp = null;
                            }
                        }
                    } else {
                        grouped = false;
                        lastMessageFrom = null;
                        lastGroupedMessageTimeStamp = null;
                    }
                }

                if (
                    (v.dialogType === "remoteCallEnded" || v.dialogType === "remoteCallStarted") &&
                    v &&
                    v.wrappedChatDialogMessage
                ) {
                    v = v.wrappedChatDialogMessage;
                }


                if (v.dialogType) {
                    var messageInstance = null;
                    if (v.dialogType === 'alterParticipants') {
                        messageInstance = <AltPartsConvMessage
                            message={v}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            chatRoom={room}
                        />
                    } else if (v.dialogType === 'truncated') {
                        messageInstance = <TruncatedMessage
                            message={v}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            chatRoom={room}
                        />
                    } else if (v.dialogType === 'privilegeChange') {
                        messageInstance = <PrivilegeChange
                            message={v}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            chatRoom={room}
                        />
                    } else if (v.dialogType === 'topicChange') {
                        messageInstance = <TopicChange
                            message={v}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            chatRoom={room}
                        />
                    } else if (v.dialogType === 'openModeClosed') {
                        messageInstance = <CloseOpenModeMessage
                            message={v}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            chatRoom={room}
                        />
                    } else if (v.dialogType === 'chatHandleUpdate') {
                        messageInstance = <ChatHandleMessage
                            message={v}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            chatRoom={room}
                        />
                    }
                    messagesList.push(messageInstance);
                } else {
                    if (!v.chatRoom) {
                        // ChatDialogMessages...
                        v.chatRoom = room;
                    }

                    messagesList.push(
                        <GenericConversationMessage
                            message={v}
                            state={v.state}
                            key={v.messageId}
                            contact={Message.getContactForMessage(v)}
                            grouped={grouped}
                            onUpdate={() => {
                                self.onResizeDoUpdate();
                            }}
                            editing={self.state.editing === v.messageId || self.state.editing === v.pendingMessageId}
                            onEditStarted={($domElement) => {
                                self.editDomElement = $domElement;
                                self.props.chatRoom.scrolledToBottom = false;
                                self.setState({'editing': v.messageId});
                                self.forceUpdate();
                            }}
                            chatRoom={room}
                            onEditDone={(messageContents) => {
                                self.props.chatRoom.scrolledToBottom = true;
                                self.editDomElement = null;

                                var currentContents = v.textContents;

                                v.edited = false;

                                if (messageContents === false || messageContents === currentContents) {
                                    self.messagesListScrollable.scrollToBottom(true);
                                }
                                else if (messageContents) {
                                    room.trigger('onMessageUpdating', v);
                                    room.megaChat.plugins.chatdIntegration.updateMessage(
                                        room,
                                        v.internalId ? v.internalId : v.orderValue,
                                        messageContents
                                    );
                                    if (
                                        v.getState &&
                                        (
                                            v.getState() === Message.STATE.NOT_SENT ||
                                            v.getState() === Message.STATE.SENT
                                        ) &&
                                        !v.requiresManualRetry
                                    ) {
                                        if (v.textContents) {
                                            v.textContents = messageContents;
                                        }
                                        if (v.emoticonShortcutsProcessed) {
                                            v.emoticonShortcutsProcessed = false;
                                        }
                                        if (v.emoticonsProcessed) {
                                            v.emoticonsProcessed = false;
                                        }
                                        if (v.messageHtml) {
                                            delete v.messageHtml;
                                        }


                                        v.trigger(
                                            'onChange',
                                            [
                                                v,
                                                "textContents",
                                                "",
                                                messageContents
                                            ]
                                        );

                                        megaChat.plugins.richpreviewsFilter.processMessage({}, v, false, true);
                                    }

                                    self.messagesListScrollable.scrollToBottom(true);
                                } else if (messageContents.length === 0) {

                                    self.setState({
                                        'confirmDeleteDialog': true,
                                        'messageToBeDeleted': v
                                    });
                                }

                                self.setState({'editing': false});

                                Soon(function () {
                                    $('.chat-textarea-block:visible textarea').focus();
                                }, 300);
                            }}
                            onDeleteClicked={(e, msg) => {
                                self.setState({
                                    'editing': false,
                                    'confirmDeleteDialog': true,
                                    'messageToBeDeleted': msg
                                });
                                self.forceUpdate();
                            }}
                        />
                    );
                }
            }
        });

        var attachCloudDialog = null;
        if (self.state.attachCloudDialog === true) {
            var selected = [];
            attachCloudDialog = <CloudBrowserModalDialog.CloudBrowserDialog
                folderSelectNotAllowed={true}
                allowAttachFolders={true}
                room={room}
                onClose={() => {
                    self.setState({'attachCloudDialog': false});
                    selected = [];
                }}
                onSelected={(nodes) => {
                    selected = nodes;
                }}
                onAttachClicked={() => {
                    self.setState({'attachCloudDialog': false});

                    self.props.chatRoom.scrolledToBottom = true;

                    room.attachNodes(
                        selected
                    );
                }}
            />;
        }

        var nonLoggedInJoinChatDialog = null;
        if (self.state.nonLoggedInJoinChatDialog === true) {
            var usersCount = Object.keys(room.members).length;
            nonLoggedInJoinChatDialog = <ModalDialogsUI.ModalDialog
                title={l[20596]}
                className={"fm-dialog chat-links-preview-desktop"}
                chatRoom={room}
                onClose={() => {
                    self.setState({'nonLoggedInJoinChatDialog': false});
                }}
            >
                <div className="fm-dialog-body">
                    <div className="chatlink-contents">
                        <div className="huge-icon group-chat"></div>
                        <h3>
                            <utils.EmojiFormattedContent>
                                {room.topic ? room.getRoomTitle() : " "}
                            </utils.EmojiFormattedContent>
                        </h3>
                        <h5>{usersCount? l[20233].replace("%s", usersCount) : " "}</h5>

                        <p>{l[20595]}</p>

                        <a className="join-chat" onClick={function(e) {
                            self.setState({'nonLoggedInJoinChatDialog': false});

                            megaChat.loginOrRegisterBeforeJoining(room.publicChatHandle);
                        }}>{l[20597]}</a>

                        <a className="not-now" onClick={function(e) {
                            self.setState({'nonLoggedInJoinChatDialog': false});
                        }}>{l[18682]}</a>
                    </div>
                </div>
            </ModalDialogsUI.ModalDialog>;
        }

        var chatLinkDialog;
        if (self.state.chatLinkDialog === true) {
            chatLinkDialog = <ChatlinkDialog
                chatRoom={self.props.chatRoom}
                onClose={() => {
                    self.setState({'chatLinkDialog': false});
                }}
            />
        }

        var privateChatDialog;

        if (self.state.privateChatDialog === true) {
            if (!$.dialog || $.dialog === "create-private-chat") {
                $.dialog = "create-private-chat";

                privateChatDialog = <ModalDialogsUI.ModalDialog
                    title={l[20594]}
                    className={"fm-dialog create-private-chat"}
                    chatRoom={room}
                    onClose={() => {
                        self.setState({'privateChatDialog': false});
                        if ($.dialog === "create-private-chat") {
                            closeDialog();
                        }
                    }}
                >
                    <div className="create-private-chat-content-block fm-dialog-body">
                        <i className="huge-icon lock"></i>
                        <div className="dialog-body-text">
                            <div className="">
                                <b>{l[20590]}</b><br/>
                                {l[20591]}
                            </div>
                        </div>
                        <div className="clear"></div>
                        <div className="big-red-button" id="make-chat-private" onClick={function() {
                            self.props.chatRoom.switchOffPublicMode();
                            self.setState({'privateChatDialog': false});
                            if ($.dialog === "create-private-chat") {
                                closeDialog();
                            }
                        }}>
                            <div className="big-btn-txt">{l[20593]}</div>
                        </div>
                    </div>
                </ModalDialogsUI.ModalDialog>;

                $('.create-private-chat .fm-dialog-close').rebind('click', function() {
                    $('.create-private-chat').addClass('hidden');
                    $('.fm-dialog-overlay').addClass('hidden');
                });
                $('.create-private-chat .default-red-button').rebind('click', function() {
                    var participants = self.props.chatRoom.protocolHandler.getTrackedParticipants();
                    var promises = [];
                    promises.push(
                        ChatdIntegration._ensureKeysAreLoaded(undefined, participants)
                    );
                    var _runSwitchOffPublicMode = function() {
                        // self.state.value
                        var topic = null;
                        if (self.props.chatRoom.topic) {
                            topic = self.props.chatRoom.protocolHandler.embeddedEncryptTo(
                                self.props.chatRoom.topic,
                                strongvelope.MESSAGE_TYPES.TOPIC_CHANGE,
                                participants,
                                true,
                                self.props.chatRoom.type === "public"
                            );
                            topic = base64urlencode(topic);
                        }
                        self.props.onSwitchOffPublicMode(topic);
                    };
                    MegaPromise.allDone(promises).done(
                        function () {
                            _runSwitchOffPublicMode();
                        }
                    );
                });
            }
        }

        var sendContactDialog = null;
        if (self.state.sendContactDialog === true) {
            var excludedContacts = [];
            if (room.type == "private") {
                room.getParticipantsExceptMe().forEach(function(userHandle) {
                    var contact = M.u[userHandle];
                    if (contact) {
                        excludedContacts.push(
                            contact.u
                        );
                    }
                });
            }

            sendContactDialog = <ModalDialogsUI.SelectContactDialog
                chatRoom={room}
                exclude={excludedContacts}
                onClose={() => {
                    self.setState({'sendContactDialog': false});
                    selected = [];
                }}
                onSelectClicked={(selected) => {
                    self.setState({'sendContactDialog': false});

                    room.attachContacts(selected);
                }}
            />
        }

        var confirmDeleteDialog = null;
        if (self.state.confirmDeleteDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={__(l[8004])}
                name="delete-message"
                onClose={() => {
                    self.setState({'confirmDeleteDialog': false});
                }}
                onConfirmClicked={() => {
                    var msg = self.state.messageToBeDeleted;
                    if (!msg) {
                        return;
                    }
                    var chatdint = room.megaChat.plugins.chatdIntegration;
                    if (msg.getState() === Message.STATE.SENT ||
                        msg.getState() === Message.STATE.DELIVERED ||
                        msg.getState() === Message.STATE.NOT_SENT) {
                            const textContents = msg.textContents || '';

                            if (textContents[1] === Message.MANAGEMENT_MESSAGE_TYPES.VOICE_CLIP) {
                                const attachmentMetadata = msg.getAttachmentMeta() || [];

                                attachmentMetadata.forEach((v) => {
                                    M.moveToRubbish(v.h);
                                });
                            }

                            chatdint.deleteMessage(room, msg.internalId ? msg.internalId : msg.orderValue);
                            msg.deleted = true;
                            msg.textContents = "";
                    }
                    else if (
                        msg.getState() === Message.STATE.NOT_SENT_EXPIRED
                    ) {
                        chatdint.discardMessage(room, msg.internalId ? msg.internalId : msg.orderValue);
                    }


                    self.setState({
                        'confirmDeleteDialog': false,
                        'messageToBeDeleted': false
                    });

                    if (
                        msg.getState &&
                        msg.getState() === Message.STATE.NOT_SENT &&
                        !msg.requiresManualRetry
                    ) {
                        msg.message = "";
                        msg.textContents = "";
                        msg.messageHtml = "";
                        msg.deleted = true;

                        msg.trigger(
                            'onChange',
                            [
                                msg,
                                "deleted",
                                false,
                                true
                            ]
                        );
                    }

                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[8879])}
                    </div>

                    <GenericConversationMessage
                        className=" dialog-wrapper"
                        message={self.state.messageToBeDeleted}
                        hideActionButtons={true}
                        initTextScrolling={true}
                        dialog={true}
                        chatRoom={self.props.chatRoom}
                    />
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }

        var pasteImageConfirmDialog = null;
        if (self.state.pasteImageConfirmDialog) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={__(l[20905])}
                name="paste-image-chat"
                onClose={() => {
                    self.setState({'pasteImageConfirmDialog': false});
                }}
                onConfirmClicked={() => {
                    var meta = self.state.pasteImageConfirmDialog;
                    if (!meta) {
                        return;
                    }

                    try {
                        Object.defineProperty(meta[0], 'name', {
                            configurable: true,
                            writeable: true,
                            value: Date.now() + '.' + M.getSafeName(meta[1] || meta[0].name)
                        });
                    }
                    catch (e) {}

                    self.props.chatRoom.scrolledToBottom = true;

                    M.addUpload([meta[0]]);

                    self.setState({
                        'pasteImageConfirmDialog': false
                    });

                    URL.revokeObjectURL(meta[2]);
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[20906])}
                    </div>

                    <img
                        src={self.state.pasteImageConfirmDialog[2]}
                        style={{
                            maxWidth: "90%",
                            height: "auto",
                            maxHeight: $(document).outerHeight() * 0.3,
                            margin: '10px auto',
                            display: 'block',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                        onLoad={function(e) {
                            $(e.target).parents('.paste-image-chat').position({
                                of: $(document.body)
                            });
                        }}
                    />
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }


        var confirmTruncateDialog = null;
        if (self.state.truncateDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={__(l[8871])}
                name="truncate-conversation"
                dontShowAgainCheckbox={false}
                onClose={() => {
                    self.setState({'truncateDialog': false});
                }}
                onConfirmClicked={() => {
                    self.props.chatRoom.scrolledToBottom = true;

                    room.truncate();

                    self.setState({
                        'truncateDialog': false
                    });
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[8881])}
                    </div>
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }

        if (self.state.archiveDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={__(l[19068])}
                name="archive-conversation"
                onClose={() => {
                    self.setState({'archiveDialog': false});
                }}
                onConfirmClicked={() => {
                    self.props.chatRoom.scrolledToBottom = true;

                    room.archive();

                    self.setState({
                        'archiveDialog': false
                    });
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[19069])}
                    </div>
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }
        if (self.state.unarchiveDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={__(l[19063])}
                name="unarchive-conversation"
                onClose={() => {
                    self.setState({'unarchiveDialog': false});
                }}
                onConfirmClicked={() => {
                    self.props.chatRoom.scrolledToBottom = true;

                    room.unarchive();

                    self.setState({
                        'unarchiveDialog': false
                    });
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[19064])}
                    </div>
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }
        if (self.state.renameDialog === true) {
            var onEditSubmit = function(e) {
                if (self.props.chatRoom.setRoomTitle(self.state.renameDialogValue)) {
                    self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                }
                e.preventDefault();
                e.stopPropagation();
            };
            var renameDialogValue = typeof(self.state.renameDialogValue) !== 'undefined' ?
                self.state.renameDialogValue :
                self.props.chatRoom.getRoomTitle();

            confirmDeleteDialog = <ModalDialogsUI.ModalDialog
                chatRoom={room}
                title={__(l[9080])}
                name="rename-group"
                className="chat-rename-dialog"
                onClose={() => {
                    self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                }}
                buttons={[
                    {
                        "label": l[61],
                        "key": "rename",
                        "className": (
                            $.trim(self.state.renameDialogValue).length === 0 ||
                            self.state.renameDialogValue === self.props.chatRoom.getRoomTitle() ?
                                "disabled" : ""
                        ),
                        "onClick": function(e) {
                            onEditSubmit(e);
                        }
                    },
                    {
                        "label": l[1686],
                        "key": "cancel",
                        "onClick": function(e) {
                            self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    },
                ]}>
                <div className="fm-dialog-content">
                    <div className="dialog secondary-header">
                        <div className="rename-input-bl">
                            <input
                                type="text"
                                className="chat-rename-group-dialog"
                                name="newTopic"
                                value={renameDialogValue}
                                maxLength="30"
                                onChange={(e) => {
                                    self.setState({
                                        'renameDialogValue': e.target.value.substr(0, 30)
                                    });
                                }}
                                onKeyUp={(e) => {
                                    if (e.which === 13) {
                                        onEditSubmit(e);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </ModalDialogsUI.ModalDialog>
        }

        var additionalClass = "";
        if (
            additionalClass.length === 0 &&
            self.state.messagesToggledInCall &&
            room.callManagerCall &&
            room.callManagerCall.isActive()
        ) {
            additionalClass = " small-block";
        }

        var topicInfo = null;
        if (self.props.chatRoom.type === "group" || self.props.chatRoom.type === "public") {
            topicInfo = <div className="chat-topic-info">
                <div className="chat-topic-icon"></div>
                <div className="chat-topic-text">
                    <span className="txt">
                        <utils.EmojiFormattedContent>{
                            self.props.chatRoom.getRoomTitle()
                        }</utils.EmojiFormattedContent>
                    </span>
                    <span className="txt small">
                        <MembersAmount room={self.props.chatRoom} />
                    </span>
                </div>
            </div>;
        }
        else {
            contactHandle = contacts[0];
            contact = M.u[contactHandle];

            topicInfo = <ContactCard
                className="short"
                chatRoom={room}
                noContextButton="true"
                contact={contact}
                showLastGreen={true}
                key={contact.u} />;
        }

        var startCallDisabled = isStartCallDisabled(room);
        var startCallButtonClass = startCallDisabled ? " disabled" : "";
        return (
            <div className={conversationPanelClasses} onMouseMove={() => self.onMouseMove()}
                 data-room-id={self.props.chatRoom.chatId}>
                <div className={"chat-content-block " + (!room.megaChat.chatUIFlags['convPanelCollapse'] ?
                    "with-pane" : "no-pane")}>
                    {!room.megaChat.chatUIFlags['convPanelCollapse'] ? <ConversationRightArea
                        isVisible={this.props.chatRoom.isCurrentlyActive}
                        chatRoom={this.props.chatRoom}
                        roomFlags={this.props.chatRoom.flags}
                        members={this.props.chatRoom.membersSetFromApi}
                        messagesBuff={room.messagesBuff}
                        onAttachFromComputerClicked={function() {
                            self.uploadFromComputer();
                        }}
                        onTruncateClicked={function() {
                            self.setState({'truncateDialog': true});
                        }}
                        onArchiveClicked={function() {
                            self.setState({'archiveDialog': true});
                        }}
                        onUnarchiveClicked={function() {
                            self.setState({'unarchiveDialog': true});
                        }}
                        onRenameClicked={function() {
                            self.setState({
                                'renameDialog': true,
                                'renameDialogValue': self.props.chatRoom.getRoomTitle()
                            });
                        }}
                        onGetManageChatLinkClicked={function() {
                            self.setState({
                                'chatLinkDialog': true
                            });
                        }}
                        onMakePrivateClicked={function() {
                            self.setState({'privateChatDialog': true});
                        }}
                        onLeaveClicked={function() {
                            room.leave(true);
                        }}
                        onCloseClicked={function() {
                            room.destroy();
                        }}
                        onJoinViaPublicLinkClicked={function() {
                            room.joinViaPublicHandle();
                        }}
                        onSwitchOffPublicMode = {function(topic) {
                            room.switchOffPublicMode(topic);
                        }}
                        onAttachFromCloudClicked={function() {
                            self.setState({'attachCloudDialog': true});
                        }}
                        onAddParticipantSelected={function(contactHashes) {
                            self.props.chatRoom.scrolledToBottom = true;

                            if (self.props.chatRoom.type == "private") {
                                var megaChat = self.props.chatRoom.megaChat;
                                const options = {
                                    keyRotation: false,
                                    topic: ''
                                };

                                loadingDialog.show();

                                megaChat.trigger(
                                    'onNewGroupChatRequest',
                                    [
                                        self.props.chatRoom.getParticipantsExceptMe().concat(
                                            contactHashes
                                        ),
                                        options
                                    ],
                                );
                            }
                            else {
                                self.props.chatRoom.trigger('onAddUserRequest', [contactHashes]);
                            }
                        }}
                    /> : null}
                    {
                        room.callManagerCall && room.callManagerCall.isStarted() ?
                            <ConversationAVPanel
                                chatRoom={this.props.chatRoom}
                                unreadCount={this.props.chatRoom.messagesBuff.getUnreadCount()}
                                onMessagesToggle={function(isActive) {
                                    self.setState({
                                        'messagesToggledInCall': isActive
                                    }, function() {
                                        $('.js-messages-scroll-area', self.findDOMNode())
                                            .trigger('forceResize', [true]);
                                    });
                                }}
                            /> : null
                    }

                    {privateChatDialog}
                    {chatLinkDialog}
                    {nonLoggedInJoinChatDialog}
                    {attachCloudDialog}
                    {sendContactDialog}
                    {confirmDeleteDialog}
                    {confirmTruncateDialog}


                    <div className="dropdown body dropdown-arrow down-arrow tooltip not-sent-notification hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {__(l[8882])}
                        </div>
                    </div>

                    <div className=
                            "dropdown body dropdown-arrow down-arrow tooltip not-sent-notification-manual hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {__(l[8883])}
                        </div>
                    </div>

                    <div className=
                            "dropdown body dropdown-arrow down-arrow tooltip not-sent-notification-cancel hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {__(l[8884])}
                        </div>
                    </div>

                    <div className={"chat-topic-block " + topicBlockClass + (
                        self.props.chatRoom.havePendingGroupCall() || self.props.chatRoom.haveActiveCall() ?
                            " have-pending-group-call" : ""
                    )}>
                        <div className="chat-topic-buttons">
                            <Button
                                className="right"
                                disableCheckingVisibility={true}
                                icon={"small-icon " + (
                                    !room.megaChat.chatUIFlags['convPanelCollapse'] ?
                                        "arrow-in-square" :
                                        "arrow-in-square active"
                                )}
                                onClick={function() {
                                    room.megaChat.toggleUIFlag('convPanelCollapse');
                                }}
                            >
                            </Button>
                            <span>
                                <div
                                     className="button right"
                                     onClick={function() {
                                         if (!startCallDisabled) {
                                             room.startVideoCall();
                                         }
                                     }}>
                                    <i className={"small-icon small-icon video-call colorized" + startCallButtonClass
                                }></i>
                                </div>

                                <div
                                     className="button right"
                                     onClick={function() {
                                         if (!startCallDisabled) {
                                             room.startAudioCall();
                                         }
                                     }}>
                                    <i className={"small-icon small-icon audio-call colorized" + startCallButtonClass
                                    }></i>
                                </div>
                            </span>
                        </div>
                         {topicInfo}
                    </div>
                    <div className={"messages-block " + additionalClass}>
                        <div className="messages scroll-area">
                            <PerfectScrollbar
                                   onFirstInit={(ps, node) => {
                                        ps.scrollToBottom(true);
                                        self.props.chatRoom.scrolledToBottom = 1;

                                    }}
                                   onReinitialise={self.onMessagesScrollReinitialise.bind(this)}
                                   onUserScroll={self.onMessagesScrollUserScroll.bind(this)}
                                   className="js-messages-scroll-area perfectScrollbarContainer"
                                   messagesToggledInCall={self.state.messagesToggledInCall}
                                   ref={(ref) => self.messagesListScrollable = ref}
                                   chatRoom={self.props.chatRoom}
                                   messagesBuff={self.props.chatRoom.messagesBuff}
                                   editDomElement={self.state.editDomElement}
                                   editingMessageId={self.state.editing}
                                   confirmDeleteDialog={self.state.confirmDeleteDialog}
                                   renderedMessagesCount={messagesList.length}
                                   isLoading={
                                       this.props.chatRoom.messagesBuff.messagesHistoryIsLoading() ||
                                       this.props.chatRoom.activeSearches > 0 ||
                                       this.loadingShown
                                   }
                                   options={{
                                       'suppressScrollX': true
                                   }}
                                >
                                <div className="messages main-pad">
                                    <div className="messages content-area">
                                        <div className={
                                            "loading-spinner js-messages-loading light manual-management" + (
                                                !self.loadingShown ? " hidden" : ""
                                            )
                                        }
                                         key="loadingSpinner" style={{top: "50%"}}>
                                            <div className="main-loader" style={{
                                                'position': 'fixed',
                                                'top': '50%',
                                                'left': '50%'
                                            }}></div>
                                        </div>
                                        {/* add a naive pre-pusher that would eventually keep the the scrollbar
                                        realistic */}
                                        {messagesList}
                                    </div>
                                </div>
                            </PerfectScrollbar>
                        </div>
                        {
                            !anonymouschat &&
                            room.state != ChatRoom.STATE.LEFT &&
                            room.havePendingGroupCall() && (
                                !room.callManagerCall ||
                                room.callManagerCall.state !== CallManagerCall.STATE.WAITING_RESPONSE_OUTGOING
                            )    ?
                                <JoinCallNotification chatRoom={room} /> : null
                        }

                        {
                            anonymouschat || (
                                !room.membersSetFromApi.members.hasOwnProperty(u_handle) &&
                                room.type === "public" && !anonymouschat &&
                                room.publicChatHandle && room.publicChatKey
                            ) ?
                        (
                        <div className="join-chat-block">
                            <div className="join-chat-button"
                                onClick={(e) => {
                                    if (anonymouschat) {
                                        megaChat.loginOrRegisterBeforeJoining(room.publicChatHandle);
                                    }
                                    else {
                                        room.joinViaPublicHandle();
                                    }
                                }}>
                                {l[20597]}
                            </div>
                        </div>
                        ) :
                        (
                        <div className="chat-textarea-block">
                            <WhosTyping chatRoom={room} />

                            <TypingArea
                                chatRoom={self.props.chatRoom}
                                className="main-typing-area"
                                disabled={room.isReadOnly()}
                                persist={true}
                                onUpEditPressed={() => {
                                    const time = unixtime();
                                    const keys = room.messagesBuff.messages.keys();
                                    for (var i = keys.length; i--;) {
                                        var message = room.messagesBuff.messages[keys[i]];

                                        var contact = M.u[message.userId];
                                        if (!contact) {
                                            // data is still loading!
                                            continue;
                                        }

                                        if (
                                            contact.u === u_handle &&
                                            time - message.delay < MESSAGE_NOT_EDITABLE_TIMEOUT &&
                                            !message.requiresManualRetry &&
                                            !message.deleted &&
                                            (!message.type ||
                                                message instanceof Message) &&
                                            (!message.isManagement || !message.isManagement())
                                        ) {
                                            self.setState({'editing': message.messageId});
                                            self.props.chatRoom.scrolledToBottom = false;
                                            return true;
                                        }
                                    }

                                    return false;
                                }}
                                onResized={() => {
                                    self.handleWindowResize();
                                    $('.js-messages-scroll-area', self.findDOMNode()).trigger('forceResize', [true]);
                                }}
                                onConfirm={(messageContents) => {
                                    if (messageContents && messageContents.length > 0) {
                                        if (!self.props.chatRoom.scrolledToBottom) {
                                            self.props.chatRoom.scrolledToBottom = true;
                                            self.lastScrollPosition = 0;
                                            // tons of hacks required because of the super weird continuous native
                                            // scroll event under Chrome + OSX, e.g. when the user scrolls up to the
                                            // start of the chat, the event continues to be received event that the
                                            // scrollTop is now 0..and if in that time the user sends a message
                                            // the event triggers a weird "scroll up" animation out of nowhere...
                                            self.props.chatRoom.rebind('onMessagesBuffAppend.pull', function() {
                                                if (self.messagesListScrollable) {
                                                    self.messagesListScrollable.scrollToBottom(false);
                                                    setTimeout(function() {
                                                        self.messagesListScrollable.enable();
                                                    }, 1500);
                                                }
                                            });

                                            self.props.chatRoom.sendMessage(messageContents);
                                            self.messagesListScrollable.disable();
                                            self.messagesListScrollable.scrollToBottom(true);
                                        }
                                        else {
                                            self.props.chatRoom.sendMessage(messageContents);
                                        }
                                    }
                                }}
                            >
                                    <Button
                                        className="popup-button left"
                                        icon="small-icon grey-small-plus"
                                        disabled={room.isReadOnly()}
                                        >
                                        <Dropdown
                                            className="wide-dropdown attach-to-chat-popup light"
                                            noArrow="true"
                                            positionMy="left top"
                                            positionAt="left bottom"
                                            vertOffset={4}
                                        >
                                            <div className="dropdown info-txt">
                                                {__(l[19793]) ? __(l[19793]) : "Send files from..."}
                                            </div>
                                            <DropdownItem
                                                className="link-button light"
                                                icon="grey-cloud colorized"
                                                label={__(l[19794]) ? __(l[19794]) : "My Cloud Drive"}
                                                onClick={(e) => {
                                                    self.setState({'attachCloudDialog': true});
                                            }} />
                                            <DropdownItem
                                                className="link-button light"
                                                icon="grey-computer colorized"
                                                label={__(l[19795]) ? __(l[19795]) : "My computer"}
                                                onClick={(e) => {
                                                    self.uploadFromComputer();
                                            }} />
                                            <div className="chat-button-seperator"></div>
                                            <DropdownItem
                                                className="link-button light"
                                                icon="square-profile colorized"
                                                label={__(l[8628])}
                                                onClick={(e) => {
                                                    self.setState({'sendContactDialog': true});
                                            }} />
                                        </Dropdown>
                                    </Button>
                            </TypingArea>
                        </div>
                        )
                        }
                    </div>
                </div>
            </div>
        );
    }
};

export class ConversationPanels extends MegaRenderMixin {
    render() {
        var self = this;
        var now = Date.now();
        var conversations = [];

        // eslint-disable-next-line local-rules/misc-warnings
        megaChat.chats.forEach(function(chatRoom) {
            if (chatRoom.isCurrentlyActive || now - chatRoom.lastShownInUI < 15 * 60 * 1000) {
                conversations.push(
                    <ConversationPanel
                        chatUIFlags={self.props.chatUIFlags}
                        isExpanded={chatRoom.megaChat.chatUIFlags['convPanelCollapse']}
                        chatRoom={chatRoom}
                        roomType={chatRoom.type}
                        isActive={chatRoom.isCurrentlyActive}
                        messagesBuff={chatRoom.messagesBuff}
                        key={chatRoom.roomId + "_" + chatRoom.instanceIndex}
                    />
                );
            }
        });

        if (self._MuChangeListener) {
            console.assert(M.u.removeChangeListener(self._MuChangeListener));
            delete self._MuChangeListener;
        }

        if (megaChat.chats.length === 0) {
            self._MuChangeListener = M.u.addChangeListener(() => self.safeForceUpdate());
            var contactsList = [];
            var contactsListOffline = [];

            var lim = Math.min(10, M.u.length);
            var userHandles = M.u.keys();
            for (var i = 0; i < lim; i++) {
                var contact = M.u[userHandles[i]];
                if (contact.u !== u_handle && contact.c === 1) {
                    var pres = megaChat.userPresenceToCssClass(contact.presence);

                    (pres === "offline" ? contactsListOffline : contactsList).push(
                        <ContactCard contact={contact} key={contact.u} chatRoom={false}/>
                    );
                }
            }
            let emptyMessage = escapeHTML(l[8008]).replace("[P]", "<span>").replace("[/P]", "</span>");
            let button = <div className="big-red-button new-chat-link"
                onClick={() => $(document.body).trigger('startNewChatLink')}>{l[20638]}</div>;

            if (anonymouschat) {
                button = null;
                emptyMessage = '';
            }

            return (
                <div>
                    <div className="chat-right-area">
                        <div className="chat-right-area contacts-list-scroll">
                            <div className="chat-right-pad">
                                {contactsList}
                                {contactsListOffline}
                            </div>
                        </div>
                    </div>
                    <div className="empty-block">
                        <div className="empty-pad conversations">
                            <div className="fm-empty-conversations-bg"/>
                            <div className="fm-empty-cloud-txt small"
                                dangerouslySetInnerHTML={{__html: emptyMessage}}>
                            </div>
                            {button}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={"conversation-panels " + self.props.className}>
                {conversations}
            </div>
        );
    }
}

function isStartCallDisabled(room) {
    if (Object.keys(room.members).length > 20) {
        return true;
    }
    return !room.isOnlineForCalls() || room.isReadOnly() || room._callSetupPromise || !room.chatId ||
        (
            room.callManagerCall &&
            room.callManagerCall.state !== CallManagerCall.STATE.WAITING_RESPONSE_INCOMING
        )
        || (
            (room.type === "group" || room.type === "public")
            && !ENABLE_GROUP_CALLING_FLAG
        )
        || (room.getCallParticipants().length > 0)
        || (room.getParticipantsExceptMe() < 1);
}
