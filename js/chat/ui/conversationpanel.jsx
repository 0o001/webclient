import React from 'react';
import utils, { Emoji, ParsedHTML } from './../../ui/utils.jsx';
import {MegaRenderMixin, timing} from './../mixins';
import {Button} from './../../ui/buttons.jsx';
import ModalDialogsUI from './../../ui/modalDialogs.jsx';
import CloudBrowserModalDialog from './../../ui/cloudBrowserModalDialog.jsx';
import { HistoryRetentionDialog } from './../../ui/historyRetentionDialog.jsx';
import { Dropdown, DropdownItem } from './../../ui/dropdowns.jsx';
import { ContactCard, ContactPickerDialog, MembersAmount } from './../ui/contacts.jsx';
import { PerfectScrollbar } from './../../ui/perfectScrollbar.jsx';
import { Accordion } from './../../ui/accordion.jsx';
import { AccordionPanel } from './../../ui/accordion.jsx';
import { ParticipantsList } from './participantsList.jsx';
import GenericConversationMessage  from './messages/generic.jsx';
import { SharedFilesAccordionPanel } from './sharedFilesAccordionPanel.jsx';
import { IncSharesAccordionPanel } from './incomingSharesAccordionPanel.jsx';
import { ChatlinkDialog } from './../ui/chatlinkDialog.jsx';
import { ConversationAVPanel } from './conversationaudiovideopanel.jsx';
import PushSettingsDialog from './pushSettingsDialog.jsx';
import Call, { EXPANDED_FLAG, inProgressAlert } from './meetings/call.jsx';
import HistoryPanel from "./historyPanel.jsx";
import ComposedTextArea from "./composedTextArea.jsx";
import Loading from "./meetings/workflow/loading.jsx";
import Join from "./meetings/workflow/join.jsx";

const ENABLE_GROUP_CALLING_FLAG = true;
const MAX_USERS_CHAT_PRIVATE = 100;

export class JoinCallNotification extends MegaRenderMixin {
    customIsEventuallyVisible() {
        return this.props.chatRoom.isCurrentlyActive;
    }

    render() {
        const { chatRoom } = this.props;

        if (chatRoom.activeCall) {
            return null;
        }

        if (!megaChat.hasSupportForCalls) {
            return (
                <div className="in-call-notif yellow join">
                    <i className="sprite-fm-mono icon-phone"/>
                    {/* There is an active call in this room, but your browser does not support calls. */
                        l.active_call_not_supported
                    }
                </div>
            );
        }

        return (
            <div className="in-call-notif neutral join">
                <i className="sprite-fm-mono icon-phone"/>
                <ParsedHTML
                    onClick={() =>
                        inProgressAlert(true)
                            .then(() => chatRoom.joinCall())
                            .catch((ex) => d && console.warn('Already in a call.', ex))
                    }>
                    {(l[20460] || 'There is an active group call. [A]Join[/A]')
                        .replace('[A]', '<button class="mega-button positive joinActiveCall small">')
                        .replace('[/A]', '</button>')}
                </ParsedHTML>
            </div>
        );
    }
}

export class ConversationRightArea extends MegaRenderMixin {
    static defaultProps = {
        'requiresUpdateOnResize': true
    }

    constructor(props) {
        super(props);
        this.state = { contactPickerDialog: false };
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
    setRetention(chatRoom, retentionTime) {
        chatRoom.setRetention(retentionTime);
        $(document).trigger('closeDropdowns');
    }
    render() {
        const self = this;
        const { chatRoom: room, onStartCall } = self.props;

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

        var isInCall = !!room.activeCall;
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
                <div
                    className={`link-button light ${startCallButtonClass}`}
                    onClick={() => onStartCall(Call.TYPE.AUDIO)}>
                    <i className="sprite-fm-mono icon-phone" />
                    <span>{l[5896] /* `Start Audio Call` */}</span>
                </div>;
        }
        if (startVideoCallButton !== null) {
            startVideoCallButton =
                <div
                    className={`link-button light ${startCallButtonClass}`}
                    onClick={() => onStartCall(Call.TYPE.VIDEO)}>
                    <i className="sprite-fm-mono icon-video-call-filled"/>
                    <span>{l[5897] /* `Start Video Call` */}</span>
                </div>;
        }
        var AVseperator = <div className="chat-button-separator" />;
        if (endCallButton !== null) {
            endCallButton =
                <div className={"link-button light red"} onClick={() => {
                    if (room.activeCall) {
                        room.activeCall.hangUp();
                    }
                }}>
                <i className="small-icon colorized horizontal-red-handset"></i>
                    <span>{room.type === "group" || room.type === "public"
                        ? l[5883] /* Leave call */ : l[5884] /* End call */}</span>
            </div>;
        }
        var isReadOnlyElement = null;

        if (room.isReadOnly()) {
            isReadOnlyElement = <center className="center" style={{margin: "6px"}}>{l.read_only_chat}</center>;
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

        const renameButtonClass = `
            link-button
            light
            ${Call.isGuest() || room.isReadOnly() || !room.iAmOperator() ? 'disabled' : ''}
        `;

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
                className="link-button light"
                icon="sprite-fm-mono icon-add-small"
                label={l[8007]}
                disabled={
                    Call.isGuest() ||
                    /* Disable in case I don't have any more contacts to add ... */
                    !(
                        !room.isReadOnly() &&
                        room.iAmOperator() &&
                        !self.allContactsInChat(excludedParticipants)
                    )
                }
                onClick={() => {
                    this.setState({ contactPickerDialog: true });
                }}
            >
            </Button>
        );

        //
        // Push notification settings
        // ----------------------------------------------------------------------

        const { pushSettingsValue, onPushSettingsToggled, onPushSettingsClicked } = this.props;
        const pushSettingsIcon = pushSettingsValue || pushSettingsValue === 0 ?
            'icon-notification-off-filled' :
            'icon-notification-filled';
        const pushSettingsBtn = !is_chatlink && room.membersSetFromApi.members.hasOwnProperty(u_handle) && (
            <div className="push-settings">
                {AVseperator}
                <Button
                    className={`
                        link-button
                        light
                        push-settings-button
                        ${Call.isGuest() ? 'disabled' : ''}
                    `}
                    icon={`
                        sprite-fm-mono
                        ${pushSettingsIcon}
                    `}
                    label={l[16709] /* `Mute chat` */}
                    secondLabel={(() => {
                        if (pushSettingsValue !== null && pushSettingsValue !== undefined) {
                            return pushSettingsValue === 0 ?
                                // `Until I Turn It On Again``
                                PushSettingsDialog.options[Infinity] :
                                // `Muted until %s`
                                l[23539].replace(
                                    '%s',
                                    unixtimeToTimeString(pushSettingsValue)
                                );
                        }
                    })()}
                    secondLabelClass="label--green"
                    toggle={Call.isGuest() ? null : {
                        enabled: !pushSettingsValue && pushSettingsValue !== 0,
                        onClick: () =>
                            !pushSettingsValue && pushSettingsValue !== 0 ?
                                onPushSettingsClicked() :
                                onPushSettingsToggled()
                    }}
                    onClick={() => Call.isGuest() ? null : onPushSettingsClicked()}>
                </Button>
                {AVseperator}
            </div>
        );

        //
        // History Retention
        // ----------------------------------------------------------------------

        let retentionTime = room.retentionTime ? secondsToDays(room.retentionTime) : 0;
        const BASE_CLASSNAME = 'dropdown-item link-button';
        const ELEM_CLASSNAME = `${BASE_CLASSNAME} retention-history-menu__list__elem`;
        const ICON_ACTIVE = <i className="sprite-fm-mono icon-check" />;
        const retentionHistoryBtn = <Button
            className="link-button light history-retention-btn"
            icon="sprite-fm-mono icon-recents-filled"
            label={l[23436]}
            disabled={!room.iAmOperator() || room.isReadOnly() || Call.isGuest()}
            secondLabel={room.getRetentionLabel()}
            secondLabelClass="label--red"
            chatRoom={room}>
            {room.iAmOperator() ?
                <Dropdown
                    className="retention-history-menu light"
                    noArrow="false"
                    vertOffset={-53}
                    horizOffset={-205}>
                    <div className="retention-history-menu__list">
                        <div
                            className={ELEM_CLASSNAME}
                            onClick={() => this.setRetention(room, 0)}>
                            <span>{l[7070]}</span>
                            {retentionTime === 0 && ICON_ACTIVE}
                        </div>
                        <div
                            className={ELEM_CLASSNAME}
                            onClick={() => this.setRetention(room, daysToSeconds(1))}>
                            <span>{l[23437]}</span>
                            {retentionTime === 1 && ICON_ACTIVE}
                        </div>
                        <div
                            className={ELEM_CLASSNAME}
                            onClick={() => this.setRetention(room, daysToSeconds(7))}>
                            <span>{l[23438]}</span>
                            {retentionTime === 7 && ICON_ACTIVE}
                        </div>
                        <div
                            className={ELEM_CLASSNAME}
                            onClick={() => this.setRetention(room, daysToSeconds(30))}>
                            <span>{l[23439]}</span>
                            {retentionTime === 30 && ICON_ACTIVE}
                        </div>
                        <div
                            className={ELEM_CLASSNAME}
                            onClick={() => {
                                $(document).trigger('closeDropdowns');
                                self.props.onHistoryRetentionConfig();
                            }}>
                            <span>{l[23440]}</span>
                            {[0, 1, 7, 30].indexOf(retentionTime) === -1 && ICON_ACTIVE}
                        </div>
                    </div>
                </Dropdown> :
                null
            }
        </Button>;

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
                <div
                    className={`
                        chat-right-pad
                        ${room.haveActiveCall() ? 'in-call' : ''}
                    `}>
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
                                <i className="sprite-fm-mono icon-eye-reveal" />
                                {room.observers}
                            </span>
                        </div> : <div></div>}

                        <AccordionPanel
                            key="options"
                            className="have-animation buttons"
                            title={l[7537]}
                            chatRoom={room}
                            sfuClient={window.sfuClient}>
                            <div>
                            {addParticipantBtn}
                            {startAudioCallButton}
                            {startVideoCallButton}
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
                                        <i className="sprite-fm-mono icon-rename"></i>
                                        <span>{l[9080]}</span>
                                    </div>
                                ) : null
                            }
                            {
                                room.type === "public" ?
                                    (
                                        <div
                                            className={`
                                                link-button
                                                light
                                                ${Call.isGuest() ? 'disabled' : ''}
                                            `}
                                            onClick={e => {
                                                if ($(e.target).closest('.disabled').length > 0) {
                                                    return false;
                                                }
                                                self.props.onGetManageChatLinkClicked();
                                            }}>
                                            <i className="sprite-fm-mono icon-link-filled"/>
                                            <span>{l[20481] /* `Get chat link` */}</span>
                                        </div>
                                    ) : null
                            }
                            {
                                !room.membersSetFromApi.members.hasOwnProperty(u_handle) &&
                                room.type === "public" && !is_chatlink &&
                                room.publicChatHandle && room.publicChatKey ?
                                    (
                                        <div className="link-button light"
                                             onClick={(e) => {
                                                 if ($(e.target).closest('.disabled').length > 0) {
                                                     return false;
                                                 }

                                                 self.props.onJoinViaPublicLinkClicked();
                                             }}>
                                            <i className="sprite-fm-mono icon-rename"></i>
                                            <span>{l[20597]}</span>
                                        </div>
                                    ) : null
                            }

                            {AVseperator}
                            <Button
                                className="link-button light dropdown-element"
                                icon="sprite-fm-mono icon-upload-filled"
                                label={l[23753]}
                                disabled={room.isReadOnly()}
                                >
                                <Dropdown
                                    className="wide-dropdown send-files-selector light"
                                    noArrow="true"
                                    vertOffset={4}
                                    onClick={() => {}}
                                >
                                    <div className="dropdown info-txt">
                                        {l[23753] ? l[23753] : "Send..."}
                                    </div>
                                    <DropdownItem
                                        className="link-button"
                                        icon="sprite-fm-mono icon-cloud-drive"
                                        label={l[19794] ? l[19794] : "My Cloud Drive"}
                                        disabled={mega.paywall}
                                        onClick={() => {
                                            self.props.onAttachFromCloudClicked();
                                        }} />
                                    <DropdownItem
                                        className="link-button"
                                        icon="sprite-fm-mono icon-session-history"
                                        label={l[19795] ? l[19795] : "My computer"}
                                        disabled={mega.paywall}
                                        onClick={() => {
                                            self.props.onAttachFromComputerClicked();
                                        }} />
                                </Dropdown>
                            </Button>

                            {pushSettingsBtn}
                            {endCallButton}

                            <Button
                                className="link-button light clear-history-button"
                                disabled={dontShowTruncateButton || !room.members.hasOwnProperty(u_handle)}
                                onClick={() => {
                                    if (self.props.onTruncateClicked) {
                                        self.props.onTruncateClicked();
                                    }
                                }}>
                                <i className="sprite-fm-mono icon-remove" />
                                <span className="accordion-clear-history-text">{l[8871] /* Clear Chat History */}</span>
                            </Button>

                                {retentionHistoryBtn}

                            {
                                (room.iAmOperator() && (room.type === "public")) ?
                                    (
                                        <div className="chat-enable-key-rotation-paragraph">
                                            {AVseperator}
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
                                                <i className="sprite-fm-mono icon-key" />
                                                <span>{l[20623]}</span>
                                            </div>
                                            <p>
                                                <span>{l[20454]}</span>
                                            </p>
                                        </div>
                                    ) : null
                            }

                            {AVseperator}
                            {
                                <div
                                    className={`
                                        link-button
                                        light
                                        ${(room.members.hasOwnProperty(u_handle) || room.state === ChatRoom.STATE.LEFT)
                                        && !is_chatlink ? '' : 'disabled'}
                                    `}
                                    onClick={(e) => {
                                        if ($(e.target).closest('.disabled').length > 0) {
                                            return false;
                                        }
                                        if (room.isArchived()) {
                                            if (self.props.onUnarchiveClicked) {
                                                self.props.onUnarchiveClicked();
                                            }
                                        }
                                        else if (self.props.onArchiveClicked) {
                                            self.props.onArchiveClicked();
                                        }
                                    }}>
                                    <i
                                        className={`
                                            sprite-fm-mono
                                            ${room.isArchived() ? 'icon-unarchive' : 'icon-archive'}
                                        `}
                                    />
                                    <span>{room.isArchived() ? l[19065] : l[16689]}</span>
                                </div>
                            }
                            {
                                room.type !== "private" ? (
                                    <div
                                        className={`
                                            link-button
                                            light
                                            ${room.type !== "private" && !is_chatlink &&
                                            room.membersSetFromApi.members.hasOwnProperty(u_handle) &&
                                            room.membersSetFromApi.members[u_handle] !== -1 &&
                                            !room.activeCall ? '' : 'disabled'}
                                        `}
                                        onClick={(e) => {
                                            if ($(e.target).closest('.disabled').length > 0) {
                                                return false;
                                            }
                                            if (self.props.onLeaveClicked) {
                                                self.props.onLeaveClicked();
                                            }
                                        }}>
                                        <i className="sprite-fm-mono icon-disabled-filled"/>
                                        <span>{l[8633]}</span>
                                    </div>) : null
                            }
                            {
                                room._closing !== true && room.type === "public" &&
                                !is_chatlink && (
                                    !room.membersSetFromApi.members.hasOwnProperty(u_handle) ||
                                    room.membersSetFromApi.members[u_handle] === -1
                                ) ? (
                                    <div className="link-button light red" onClick={() => {
                                        if (self.props.onCloseClicked) {
                                            self.props.onCloseClicked();
                                        }
                                    }}>
                                        <i className="sprite-fm-mono icon-dialog-close" />
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
            {this.state.contactPickerDialog && <ContactPickerDialog
                exclude={excludedParticipants}
                megaChat={room.megaChat}
                multiple={true}
                className={'popup add-participant-selector'}
                singleSelectedButtonLabel={l[8869]}
                multipleSelectedButtonLabel={l[8869]}
                nothingSelectedButtonLabel={l[8870]}
                onSelectDone={(selected) => {
                    this.props.onAddParticipantSelected(selected);
                    this.setState({contactPickerDialog: false});
                }}
                onClose={() => {
                    this.setState({contactPickerDialog: false});
                }}
                selectFooter={true}
            />}
        </div>;
    }
}

export class ConversationPanel extends MegaRenderMixin {
    $container = null;
    $messages = null;

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
            pushSettingsDialog: false,
            pushSettingsValue: null,
            messageToBeDeleted: null,
            callMinimized: false,
            editing: false,
            showHistoryRetentionDialog: false,
            setNonLoggedInJoinChatDlgTrue: null
        };

        this.handleKeyDown = SoonFc(120, (ev) => this._handleKeyDown(ev));

        this.props.chatRoom.rebind("openAttachCloudDialog." + this.getUniqueId(), () => this.openAttachCloudDialog());
        this.props.chatRoom.rebind("openSendContactDialog." + this.getUniqueId(), () => this.openSendContactDialog());

    }
    customIsEventuallyVisible() {
        return this.props.chatRoom.isCurrentlyActive;
    }
    openAttachCloudDialog() {
        this.setState({ 'attachCloudDialog': true });
    }
    openSendContactDialog() {
        this.setState({ 'sendContactDialog': true });
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

    handleDeleteDialog = msg => {
        if (msg) {
            this.setState({ editing: false, confirmDeleteDialog: true, messageToBeDeleted: msg });
        }
    };

    toggleExpandedFlag = () => document.body.classList[Call.isExpanded() ? 'remove' : 'add'](EXPANDED_FLAG);

    startCall = type => {
        const { chatRoom } = this.props;

        if (isStartCallDisabled(chatRoom)) {
            return false;
        }

        return type === Call.TYPE.AUDIO ? chatRoom.startAudioCall() : chatRoom.startVideoCall();
    };

    componentDidMount() {
        super.componentDidMount();
        var self = this;
        self.$container = $('.conversation-panel', '#fmholder');
        self.$messages = $('.messages.scroll-area > .perfectScrollbarContainer', self.$container);

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
            if (otherContactHash in M.u) {
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
        if (is_chatlink && !self.props.chatRoom.isMeeting) {
            self.state.setNonLoggedInJoinChatDlgTrue = setTimeout(function() {
                M.safeShowDialog('chat-links-preview-desktop', () => {
                    if (self.isMounted()) {
                        // may not be mounted in case of getting redirected to existing room to the fm -> chat ->
                        // chatroom
                        self.setState({'nonLoggedInJoinChatDialog': true});
                    }
                });
            }, rand_range(5, 10) * 1000);
        }
        if (is_chatlink && self.props.chatRoom.isMeeting && u_type !== false && u_type < 3) {
            eventlog(99747, JSON.stringify([1, u_type | 0]), true);
        }
        self.props.chatRoom._uiIsMounted = true;
        self.props.chatRoom.$rConversationPanel = self;
        self.props.chatRoom.trigger('onComponentDidMount');
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

        var room = self.props.chatRoom;

        // collapse on ESC pressed (exited fullscreen)
        $(document)
            .rebind("fullscreenchange.megaChat_" + room.roomId, function() {
                if (self.isComponentEventuallyVisible()) {
                    self.setState({isFullscreenModeEnabled: !!$(document).fullScreen()});
                    self.forceUpdate();
                }
            });

        // var ns = ".convPanel";
        // $container
        //     .rebind('animationend' + ns +' webkitAnimationEnd' + ns + ' oAnimationEnd' + ns, function(e) {
        //         self.safeForceUpdate(true);
        //         $.tresizer();
        //     });
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        var self = this;
        var chatRoom = self.props.chatRoom;

        chatRoom._uiIsMounted = true;

        if (this._privateChangeListener) {
            var otherContactHash = self.props.chatRoom.getParticipantsExceptMe()[0];
            if (otherContactHash in M.u) {
                M.u[otherContactHash].removeChangeListener(this._privateChangeListener);
                delete this._privateChangeListener;
            }
        }

        this.props.chatRoom.unbind("openAttachCloudDialog." + this.getUniqueId());
        this.props.chatRoom.unbind("openSendContactDialog." + this.getUniqueId());
        window.removeEventListener('keydown', self.handleKeyDown);
        $(document).off("fullscreenchange.megaChat_" + chatRoom.roomId);
        $(document).off('keydown.keyboardScroll_' + chatRoom.roomId);
    }
    componentDidUpdate(prevProps, prevState) {
        var self = this;
        var room = this.props.chatRoom;

        self.eventuallyInit(false);

        room.megaChat.updateSectionUnreadCount();

        var domNode = self.findDOMNode();

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



        if (self.$messages && self.isComponentEventuallyVisible()) {
            $(window).rebind('pastedimage.chatRoom', function(e, blob, fileName) {
                if (self.$messages && self.isComponentEventuallyVisible()) {
                    self.setState({'pasteImageConfirmDialog': [blob, fileName, URL.createObjectURL(blob)]});
                    e.preventDefault();
                }
            });
            self.props.chatRoom.trigger("onComponentDidUpdate");
        }
    }

    isActive() {
        return document.hasFocus() && this.$messages && this.$messages.is(":visible");
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

        var conversationPanelClasses = "conversation-panel " + (room.type === "public" ? "group-chat " : "") +
            room.type + "-chat";

        if (!room.isCurrentlyActive || megaChat._joinDialogIsShown) {
            conversationPanelClasses += " hidden";
        }

        var topicBlockClass = "chat-topic-block";
        if (room.type !== "public") {
            topicBlockClass += " privateChat";
        }


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
            let closeJoinDialog = () => {
                onIdle(() => {
                    if ($.dialog === 'chat-links-preview-desktop') {
                        closeDialog();
                    }
                });
                self.setState({'nonLoggedInJoinChatDialog': false});
            };
            nonLoggedInJoinChatDialog =
                <ModalDialogsUI.ModalDialog
                    title={l[20596]}
                    className={"mega-dialog chat-links-preview-desktop dialog-template-graphic"}
                    chatRoom={room}
                    onClose={closeJoinDialog}>
                    <section className="content">
                        <div className="chatlink-contents">
                            <div className="huge-icon group-chat" />
                            <h3>
                                <Emoji>
                                    {room.topic ? room.getRoomTitle() : " "}
                                </Emoji>
                            </h3>
                            <h5>{usersCount ? l[20233].replace("%s", usersCount) : " "}</h5>
                            <p>{l[20595]}</p>
                        </div>
                    </section>
                    <footer>
                        <div className="bottom-buttons">
                            <button
                                className="mega-button positive"
                                onClick={() => {
                                    closeJoinDialog();
                                    megaChat.loginOrRegisterBeforeJoining(
                                        room.publicChatHandle,
                                        false,
                                        false,
                                        false,
                                        () => {
                                            megaChat.routing.reinitAndJoinPublicChat(
                                                room.chatId,
                                                room.publicChatHandle,
                                                room.publicChatKey
                                            ).then(
                                                () => {
                                                    delete megaChat.initialPubChatHandle;
                                                },
                                                (ex) => {
                                                    console.error("Failed to join room:", ex);
                                                }
                                            );
                                        }
                                    );
                                }}>
                                {l[20597]}
                            </button>
                            <button className="mega-button" onClick={closeJoinDialog}>{l[18682]}</button>
                        </div>
                    </footer>
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

        let privateChatDialog;
        if (self.state.privateChatDialog === true) {
            const onClose = () => this.setState({ privateChatDialog: false });
            privateChatDialog = (
                <ModalDialogsUI.ModalDialog
                    title={l[20594]}
                    className="mega-dialog create-private-chat"
                    chatRoom={room}
                    onClose={onClose}
                    dialogType="action"
                    dialogName="create-private-chat-dialog">

                    <section className="content">
                        <div className="content-block">
                            <i className="huge-icon lock" />
                            <div className="dialog-body-text">
                                <strong>{l[20590]}</strong>
                                <br />
                                <span>{l[20591]}</span>
                            </div>
                        </div>
                    </section>

                    <footer>
                        <div className="footer-container">
                            <button
                                className="mega-button positive large"
                                onClick={() => {
                                    this.props.chatRoom.switchOffPublicMode();
                                    onClose();
                                }}>
                                <span>{l[20593]}</span>
                            </button>
                        </div>
                    </footer>
                </ModalDialogsUI.ModalDialog>
            );
        }

        var sendContactDialog = null;
        if (self.state.sendContactDialog === true) {
            var excludedContacts = [];
            if (room.type == "private") {
                room.getParticipantsExceptMe().forEach(function(userHandle) {
                    if (userHandle in M.u) {
                        excludedContacts.push(
                            M.u[userHandle].u
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
                dialogType="main"
                title={l[8004]}
                subtitle={l[8879]}
                name="delete-message"
                pref="1"
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

                <section className="content">
                    <div className="content-block">
                        <GenericConversationMessage
                            className=" dialog-wrapper"
                            message={self.state.messageToBeDeleted}
                            hideActionButtons={true}
                            initTextScrolling={true}
                            dialog={true}
                            chatRoom={self.props.chatRoom}
                        />
                    </div>
                </section>
            </ModalDialogsUI.ConfirmDialog>
        }

        var pasteImageConfirmDialog = null;
        if (self.state.pasteImageConfirmDialog) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={l[20905]}
                subtitle={l[20906]}
                icon="sprite-fm-uni icon-question"
                name="paste-image-chat"
                pref="2"
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
            </ModalDialogsUI.ConfirmDialog>
        }

        //
        // Push notification settings
        // ----------------------------------------------------------------------

        let pushSettingsDialog = null;
        if (self.state.pushSettingsDialog === true) {
            const state = { pushSettingsDialog: false, pushSettingsValue: null };
            pushSettingsDialog = (
                <PushSettingsDialog
                    room={room}
                    pushSettingsValue={this.state.pushSettingsValue}
                    onClose={() =>
                        this.setState({ ...state, pushSettingsValue: this.state.pushSettingsValue })
                    }
                    onConfirm={pushSettingsValue =>
                        self.setState({ ...state, pushSettingsValue }, () =>
                            pushNotificationSettings.setDnd(
                                room.chatId,
                                pushSettingsValue === Infinity ? 0 : unixtime() + pushSettingsValue * 60
                            )
                        )
                    }
                />
            );
        }

        var confirmTruncateDialog = null;
        if (self.state.truncateDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={l[8871]}
                subtitle={l[8881]}
                icon="sprite-fm-uni icon-question"
                name="truncate-conversation"
                pref="3"
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
            />;
        }

        if (self.state.archiveDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={l[19068]}
                subtitle={l[19069]}
                icon="sprite-fm-uni icon-question"
                name="archive-conversation"
                pref="4"
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
            />;
        }
        if (self.state.unarchiveDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                chatRoom={room}
                title={l[19063]}
                subtitle={l[19064]}
                icon="sprite-fm-uni icon-question"
                name="unarchive-conversation"
                pref="5"
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
            />;
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
                title={l[9080]}
                name="rename-group"
                className="chat-rename-dialog dialog-template-main"
                onClose={() => {
                    self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                }}
                buttons={[
                    {
                        "label": l[1686],
                        "key": "cancel",
                        "onClick": function(e) {
                            self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    },
                    {
                        "label": l[61],
                        "key": "rename",
                        "className": (
                            $.trim(self.state.renameDialogValue).length === 0 ||
                            self.state.renameDialogValue === self.props.chatRoom.getRoomTitle() ?
                                "positive disabled" : "positive"
                        ),
                        "onClick": function(e) {
                            onEditSubmit(e);
                        }
                    },
                ]}>
                <section className="content">
                    <div className="content-block">
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
                </section>
            </ModalDialogsUI.ModalDialog>
        }

        var additionalClass = "";

        var topicInfo = null;
        if (self.props.chatRoom.type === "group" || self.props.chatRoom.type === "public") {
            topicInfo = <div className="chat-topic-info">
                <div className="chat-topic-icon">
                    <i className="sprite-fm-uni icon-chat-group" />
                </div>
                <div className="chat-topic-text">
                    <span className="txt">
                        <Emoji>{self.props.chatRoom.getRoomTitle()}</Emoji>
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
        let historyRetentionDialog = null;
        if (self.state.showHistoryRetentionDialog === true) {
            historyRetentionDialog = <HistoryRetentionDialog
                chatRoom={room}
                title={''}
                name="rename-group"
                className=""
                onClose={() => {
                    self.setState({ showHistoryRetentionDialog: false });
                }}
            />;
        }


        var startCallDisabled = isStartCallDisabled(room);
        var startCallButtonClass = startCallDisabled ? " disabled" : "";
        return (
            <div
                className={conversationPanelClasses}
                onMouseMove={() => self.onMouseMove()}
                data-room-id={self.props.chatRoom.chatId}>
                {room.meetingsLoading && <Loading chatRoom={room} title={room.meetingsLoading} />}
                {room.sfuApp && (
                    <Call
                        chatRoom={room}
                        sfuApp={room.sfuApp}
                        streams={room.sfuApp.callManagerCall.peers}
                        call={room.sfuApp.callManagerCall}
                        minimized={this.state.callMinimized}
                        onCallMinimize={() => {
                            return this.state.callMinimized ?
                                null :
                                this.setState({ callMinimized: true }, () => {
                                    this.toggleExpandedFlag();
                                    this.safeForceUpdate();
                                });
                        }}
                        onCallExpand={() => {
                            return this.state.callMinimized &&
                                this.setState({ callMinimized: false }, () => {
                                    loadSubPage('fm/chat');
                                    room.show();
                                    this.toggleExpandedFlag();
                                });
                        }}
                        didMount={this.toggleExpandedFlag}
                        willUnmount={minimised =>
                            this.setState({ callMinimized: false }, () =>
                                minimised ? null : this.toggleExpandedFlag()
                            )
                        }
                        onCallEnd={() => this.safeForceUpdate()}
                        onDeleteMessage={this.handleDeleteDialog}
                        parent={this}
                    />
                )}
                {megaChat.initialPubChatHandle && room.publicChatHandle === megaChat.initialPubChatHandle &&
                    !room.activeCall && (
                    room.isMeeting && !room.activeCall && room.activeCallIds.length > 0
                ) &&
                    <Join
                        initialView={u_type || is_eplusplus ? Join.VIEW.ACCOUNT : Join.VIEW.INITIAL}
                        chatRoom={room}
                        onJoinGuestClick={(firstName, lastName, audioFlag, videoFlag) => {
                            room.meetingsLoading = l.joining;
                            u_eplusplus(firstName, lastName)
                                .then(() => {
                                    return megaChat.routing.reinitAndJoinPublicChat(
                                        room.chatId,
                                        room.publicChatHandle,
                                        room.publicChatKey
                                    );
                                })
                                .then(() => {
                                    delete megaChat.initialPubChatHandle;
                                    return megaChat.getChatById(room.chatId).joinCall(audioFlag, videoFlag);
                                })
                                .catch((ex) => {
                                    if (d) {
                                        console.error('E++ account failure!', ex);
                                    }

                                    setTimeout(() => {
                                        msgDialog(
                                            'warninga',
                                            l[135],
                                            /* Failed to create E++ account. Please try again later. */
                                            l.eplusplus_create_failed,
                                            escapeHTML(api_strerror(ex) || ex)
                                        );
                                    }, 1234);

                                    eventlog(99745, JSON.stringify([1, String(ex).split('\n')[0]]));
                                });
                        }}
                        onJoinClick={(audioFlag, videoFlag) => {
                            const chatId = room.chatId;
                            if (room.members[u_handle]) {
                                delete megaChat.initialPubChatHandle;
                                megaChat.routing.reinitAndOpenExistingChat(chatId, room.publicChatHandle)
                                    .then(() => {
                                        megaChat.getChatById(chatId).joinCall(audioFlag, videoFlag);
                                    }, (ex) => {
                                        console.error("Failed to open existing room and join call:", ex);
                                    });
                            }
                            else {
                                megaChat.routing.reinitAndJoinPublicChat(
                                    chatId,
                                    room.publicChatHandle,
                                    room.publicChatKey
                                ).then(
                                    () => {
                                        delete megaChat.initialPubChatHandle;
                                        megaChat.getChatById(chatId).joinCall(audioFlag, videoFlag);
                                    },
                                    (ex) => {
                                        console.error("Failed to join room:", ex);
                                    }
                                );
                            }

                        }}
                    />
                }
                <div className={"chat-content-block " + (!room.megaChat.chatUIFlags['convPanelCollapse'] ?
                    "with-pane" : "no-pane")}>
                    {!room.megaChat.chatUIFlags['convPanelCollapse'] ? <ConversationRightArea
                        isVisible={this.props.chatRoom.isCurrentlyActive}
                        chatRoom={this.props.chatRoom}
                        roomFlags={this.props.chatRoom.flags}
                        members={this.props.chatRoom.membersSetFromApi}
                        messagesBuff={room.messagesBuff}
                        pushSettingsValue={pushNotificationSettings.getDnd(this.props.chatRoom.chatId)}
                        onStartCall={(mode) =>
                            inProgressAlert()
                                .then(() => this.startCall(mode))
                                .catch(() => d && console.warn('Already in a call.'))
                        }
                        onAttachFromComputerClicked={function() {
                            self.props.chatRoom.uploadFromComputer();
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
                        onPushSettingsClicked={function() {
                            self.setState({ 'pushSettingsDialog': true });
                        }}
                        onPushSettingsToggled={function() {
                            return room.dnd || room.dnd === 0 ?
                                self.setState({ pushSettingsValue: null }, () =>
                                    pushNotificationSettings.disableDnd(room.chatId)
                                ) :
                                pushNotificationSettings.setDnd(room.chatId, 0);
                        }}
                        onHistoryRetentionConfig={function() {
                            self.setState({showHistoryRetentionDialog: true});
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
                    {historyRetentionDialog}
                    {confirmTruncateDialog}
                    {pushSettingsDialog}


                    <div className="dropdown body dropdown-arrow down-arrow tooltip not-sent-notification hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {l[8882]}
                        </div>
                    </div>


                    <div
                        className={`
                            chat-topic-block
                            ${topicBlockClass}
                            ${room.haveActiveCall() ? 'in-call' : ''}
                        `}>
                        <div className="chat-topic-buttons">
                            <Button
                                className="right"
                                disableCheckingVisibility={true}
                                icon="sprite-fm-mono icon-info-filled"
                                onClick={() => room.megaChat.toggleUIFlag('convPanelCollapse')} />
                            <Button
                                className={`
                                    button
                                    right
                                    ${startCallDisabled ? 'disabled' : ''}
                                `}
                                icon="sprite-fm-mono icon-video-call-filled"
                                onClick={() =>
                                    startCallDisabled ?
                                        false :
                                        inProgressAlert()
                                            .then(() => this.startCall(Call.TYPE.VIDEO))
                                            .catch(() => d && console.warn('Already in a call.'))
                                }
                            />
                            <Button
                                className={`
                                    button
                                    right
                                    ${startCallDisabled ? 'disabled' : ''}
                                `}
                                icon="sprite-fm-mono icon-phone"
                                onClick={() =>
                                    startCallDisabled ?
                                        false :
                                        inProgressAlert()
                                            .then(() => this.startCall(Call.TYPE.AUDIO))
                                            .catch(() => d && console.warn('Already in a call.'))
                                }
                            />
                        </div>
                        {topicInfo}
                    </div>

                    <div className={"messages-block " + additionalClass}>

                        <HistoryPanel
                            {...this.props}
                            onMessagesListScrollableMount={mls => {
                                this.messagesListScrollable = mls;
                            }}
                            ref={historyPanel => {
                                this.historyPanel = historyPanel;
                            }}
                            onDeleteClicked={this.handleDeleteDialog}
                        />

                        {
                            !is_chatlink &&
                            room.state != ChatRoom.STATE.LEFT &&
                            (room.havePendingGroupCall() || room.havePendingCall()) ?
                                <JoinCallNotification chatRoom={room} /> : null
                        }

                        {
                            (
                                room.isAnonymous()
                            ) ?
                        (
                        <div className="join-chat-block">
                            <div className="mega-button large positive"
                                onClick={() => {
                                    const join = () => {
                                        megaChat.routing.reinitAndJoinPublicChat(
                                            room.chatId,
                                            room.publicChatHandle,
                                            room.publicChatKey
                                        ).then(
                                            () => delete megaChat.initialPubChatHandle,
                                            ex => console.error("Failed to join room:", ex)
                                        );
                                    };

                                    if (u_type === 0) {
                                        return loadSubPage('register');
                                    }

                                    if (u_type === false) {
                                        clearTimeout(self.state.setNonLoggedInJoinChatDlgTrue);
                                        megaChat.loginOrRegisterBeforeJoining(
                                            room.publicChatHandle,
                                            false,
                                            false,
                                            false,
                                            join
                                        );
                                        return;
                                    }

                                    clearTimeout(self.state.setNonLoggedInJoinChatDlgTrue);
                                    join();
                                }}>
                                {l[20597] /* `Join Group` */}
                            </div>
                        </div>
                        ) :
                        <ComposedTextArea chatRoom={room} parent={this} />
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
        let ringingDialogs = [];

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
            if (megaChat.routingSection !== "chat") {
                return null;
            }
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
            let button = <button className="mega-button positive large new-chat-link"
                onClick={() => $(document.body).trigger('startNewChatLink')}><span>{l[20638]}</span></button>;

            if (is_chatlink) {
                button = null;
                emptyMessage = '';
            }

            const hasContacts = !!contactsList.length || !!contactsListOffline.length;
            return (
                <div>
                    {hasContacts && (
                        <div className="chat-right-area">
                            <div className="chat-right-area contacts-list-scroll">
                                <div className="chat-right-pad">
                                    {contactsList}
                                    {contactsListOffline}
                                </div>
                            </div>
                        </div>
                    )}
                    <div
                        className={`
                            fm-empty-section
                            ${hasContacts ? 'empty-messages' : 'empty-conversations'}
                        `}>
                        <div className="fm-empty-pad">
                            <i className="section-icon sprite-fm-mono icon-chat-filled"/>
                            <div className="fm-empty-cloud-txt small">
                                <ParsedHTML>{emptyMessage}</ParsedHTML>
                            </div>
                            {button}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={"conversation-panels " + self.props.className}>
                {ringingDialogs}
                {conversations}
            </div>
        );
    }
}

function isStartCallDisabled(room) {
    if (Call.isGuest()) {
        return true;
    }
    if (!megaChat.hasSupportForCalls) {
        return true;
    }
    return !room.isOnlineForCalls() || room.isReadOnly() || !room.chatId || room.activeCall ||
        (
            (room.type === "group" || room.type === "public")
            && !ENABLE_GROUP_CALLING_FLAG
        )
        || (room.getCallParticipants().length > 0);
}
