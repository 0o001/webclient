import React from 'react';
import { MegaRenderMixin } from '../../../mixins';
import ModalDialogsUI from '../../../../ui/modalDialogs.jsx';
import utils, { EmojiFormattedContent } from '../../../../ui/utils.jsx';
import Button from '../button.jsx';
import Preview from './preview.jsx';
import HistoryPanel from "../../historyPanel.jsx";
import MeetingsCallEndedDialog from '../meetingsCallEndedDialog.jsx';

export default class Join extends MegaRenderMixin {
    static NAMESPACE = 'join-meeting';

    static VIEW = {
        INITIAL: 0,
        GUEST: 1,
        ACCOUNT: 2,
        UNSUPPORTED: 4
    };

    state = {
        preview: false,
        view: Join.VIEW.INITIAL,
        firstName: '',
        lastName: '',
        previewAudio: false,
        previewVideo: false,
        ephemeralDialog: false
    };

    constructor(props) {
        super(props);
        this.state.view = sessionStorage.guestForced ? Join.VIEW.GUEST : props.initialView || this.state.view;
        if (localStorage.awaitingConfirmationAccount) {
            this.showConfirmationDialog();
        }
    }

    handleKeyDown = ({ key }) => {
        return key && key === 'Escape' ? this.props.onClose?.() : true;
    };

    showPanels = () => {
        return [
            document.querySelector('.nw-fm-left-icons-panel'),
            document.querySelector('.chat-app-container'),
        ]
            .map(el => el && el.classList.remove('hidden'));
    };

    hidePanels = () => {
        return [
            document.querySelector('.nw-fm-left-icons-panel'),
            document.querySelector('.chat-app-container')
        ]
            .map(el => el && el.classList.add('hidden'));
    };

    showConfirmationDialog = () => {
        megaChat.destroy();
        return mega.ui.sendSignupLinkDialog(JSON.parse(localStorage.awaitingConfirmationAccount), () => {
            delete localStorage.awaitingConfirmationAccount;
            u_logout(true);
            location.reload();
        });
    };

    Ephemeral = () => {
        const onCancel = () => this.setState({ ephemeralDialog: false });
        const onConfirm = () => {
            u_logout(true);
            sessionStorage.guestForced = true;
            location.reload();
        };
        const msgFragments = l.ephemeral_data_lost.split(/\[A]|\[\/A]/);

        return (
            <ModalDialogsUI.ModalDialog
                name="end-ephemeral"
                dialogType="message"
                icon="sprite-fm-uni icon-warning"
                title={l.ephemeral_data_lost_title}
                noCloseOnClickOutside={true}
                buttons={[
                    { key: 'cancel', label: l[82] /* Cancel */, onClick: onCancel },
                    { key: 'continue', label: l[507] /* Continue */, className: 'positive', onClick: onConfirm }
                ]}
                onClose={onCancel}>
                <p>
                    {msgFragments[0]}<a href="#" onClick={
                        () => loadSubPage('register')}>{msgFragments[1]}</a>{msgFragments[2]}
                </p>
            </ModalDialogsUI.ModalDialog>
        );
    };

    Head = () => {
        return (
            <div className={`${Join.NAMESPACE}-head`}>
                <div className={`${Join.NAMESPACE}-logo`}>
                    <i
                        className={`
                            sprite-fm-illustration-wide
                            ${document.body.classList.contains('theme-dark') ? 'mega-logo-dark' : 'img-mega-logo-light'}
                        `}
                    />
                </div>
                <h1>
                    <EmojiFormattedContent>
                        {l.you_have_invitation.replace('%1', this.props.chatRoom?.topic)}
                    </EmojiFormattedContent>
                </h1>
                {isEphemeral() && (
                    <div className="ephemeral-info">
                        <i className="sprite-fm-uni icon-warning" />
                        <p>
                            {l.ephemeral_data_store_lost}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    Intro = () => {
        const $$CONTAINER = ({ children }) =>
            <>
                <div className={`${Join.NAMESPACE}-content`}>{children}</div>
                {this.Chat()}
            </>;

        //
        // Ephemeral session, w/ `Join as guest` and `Create account` controls
        // https://mega.nz/file/4EMzXaQY#g2HGbYKVj_nNk2HL8rwDfZ5gEZcePBSXP6yIn1sde04
        // -------------------------------------------------------------------------

        if (isEphemeral()) {
            return (
                <$$CONTAINER>
                    <Button
                        className="mega-button positive"
                        onClick={() => this.setState({ ephemeralDialog: true })}>
                        {l.join_as_guest /* `Join as guest` */}
                    </Button>
                    <Button
                        className="mega-button"
                        onClick={() => loadSubPage('register')}>
                        {l[5582] /* `Create account` */}
                    </Button>
                    <span>
                        {l[5585] /* `Already have an account?` */}
                        <a
                            href="#"
                            onClick={ev => {
                                ev.preventDefault();
                                mega.ui.showLoginRequiredDialog({ minUserType: 3, skipInitialDialog: 1 })
                                    .done(() => this.setState({ view: Join.VIEW.ACCOUNT }));
                            }}>
                            {l[171]}
                        </a>
                    </span>
                </$$CONTAINER>
            );
        }


        //
        // Default state for guests, w/ `Join as guest`, `Login` and `Create account` controls
        // https://mega.nz/file/QB9GiCLS#dRZxfZde231SHp_JHgyoN6kKIEbyzqWSSnkwOin_Fpc
        // -------------------------------------------------------------------------

        return (
            <$$CONTAINER>
                <Button
                    className="mega-button positive"
                    onClick={() => this.setState({ view: Join.VIEW.GUEST })}>
                    {l.join_as_guest /* `Join as guest` */}
                </Button>
                <Button
                    className="mega-button"
                    onClick={() => {
                        megaChat.loginOrRegisterBeforeJoining(
                            this.props.chatRoom?.publicChatHandle,
                            false,
                            true,
                            undefined,
                            () => this.setState({ view: Join.VIEW.ACCOUNT })
                        );
                    }}>
                    {l[171] /* `Login` */}
                </Button>
                <p>
                    <span
                        dangerouslySetInnerHTML={{ __html: l[20635] /* `Don't have an account? Create one now` */ }}
                        onClick={e => {
                            e.preventDefault();
                            megaChat.loginOrRegisterBeforeJoining(
                                this.props.chatRoom.publicChatHandle,
                                true,
                                undefined,
                                undefined,
                                () => this.setState({ view: Join.VIEW.ACCOUNT })
                            );
                        }}
                    />
                </p>
            </$$CONTAINER>
        );
    };

    Chat = () => {
        const { chatRoom } = this.props;
        const { preview } = this.state;

        return (
            <div
                className={`
                    ${Join.NAMESPACE}-chat
                    ${preview ? 'expanded' : ''}
                `}>
                <div className="chat-content">
                    <div
                        className="chat-content-head"
                        onClick={() => this.setState({ preview: !preview })}>
                        <EmojiFormattedContent>{chatRoom.topic}</EmojiFormattedContent>
                        <Button icon="icon-minimise" />
                    </div>
                    {preview && (
                        <div className="chat-body">
                            <HistoryPanel
                                chatRoom={chatRoom}
                                onMount={(cmp) => cmp.messagesListScrollable.scrollToBottom()}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    Card = ({ children }) =>
        <div className="card">
            <div className="card-body">
                {children}
                <div>
                    <a href="/securechat">{l.how_meetings_work}</a>
                </div>
            </div>
            <div className="card-preview">
                <Preview onToggle={(audio, video) => this.setState({ previewAudio: audio, previewVideo: video })} />
            </div>
        </div>;

    Field = ({ name, children }) => {
        return (
            <div
                className={`
                    mega-input
                    title-ontop
                    ${this.state[name]?.length ? 'valued' : ''}
                `}>
                <div className="mega-input-title">
                    {children}
                    <span className="required-red">*</span>
                </div>
                <input
                    type="text"
                    name={name}
                    className="titleTop required megaInputs"
                    placeholder={children}
                    value={this.state[name] || ''}
                    onChange={ev => this.setState({ [name]: ev.target.value })}
                />
            </div>
        );
    };

    Guest = () =>
        <this.Card>
            <h2>{l.enter_name_join_meeting}</h2>
            <div className="card-fields">
                <this.Field name="firstName">{l[1096]}</this.Field>
                <this.Field name="lastName">{l[1097]}</this.Field>
            </div>
            <Button
                className={`
                    mega-button
                    positive
                    large
                    ${this.state.firstName.length && this.state.lastName.length ? '' : 'disabled'}
                    ${this.state.joining && " loading disabled"}
                `}
                onClick={() => {
                    if (this.state.joining) {
                        return;
                    }
                    let { firstName, lastName, previewAudio, previewVideo } = this.state;
                    firstName = firstName && firstName.trim();
                    lastName = lastName && lastName.trim();
                    if (firstName && lastName && firstName.length > 0 && lastName.length > 0) {
                        this.setState({'joining': true});

                        this.props.onJoinGuestClick(
                            firstName,
                            lastName,
                            previewAudio,
                            previewVideo
                        );
                    }
                }}>
                {l.join_chat_button}
            </Button>
        </this.Card>;

    Account = () =>
        <this.Card>
            <h4>{l.join_meeting}</h4>
            <Button
                className={`mega-button positive large ${this.state.joining && " loading disabled"}`}
                onClick={() => {
                    if (!this.state.joining) {
                        this.setState({'joining': true});
                        this.props.onJoinClick(this.state.previewAudio, this.state.previewVideo);
                    }
                }}>
                Join
            </Button>
        </this.Card>;

    Unsupported = () =>
        <div className="unsupported-container">
            <i className="sprite-fm-uni icon-error" />
            <div className="unsupported-info">
                <h3>Your browser can&apos;t support MEGA meeting</h3>
                <h3>You can join meeting via the following approaches:</h3>
                <ul>
                    <li>Open the link via Chrome version XXX</li>
                    <li>Join via Mobile apps <a href="#">Download Mobile App</a></li>
                </ul>
            </div>
        </div>;

    View = (view) => {
        switch (view) {
            default:
                return this.Intro();
            case Join.VIEW.GUEST:
                return this.Guest();
            case Join.VIEW.ACCOUNT:
                return this.Account();
            case Join.VIEW.UNSUPPORTED:
                return this.Unsupported();
        }
    };

    componentDidMount() {
        super.componentDidMount();
        document.addEventListener('keydown', this.handleKeyDown);
        this.hidePanels();
        megaChat._joinDialogIsShown = true;
        alarm.hideAllWarningPopups();
        if ($.dialog === MeetingsCallEndedDialog.dialogName) {
            closeDialog();
        }
        sessionStorage.removeItem('guestForced');
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        document.removeEventListener('keydown', this.handleKeyDown);
        this.showPanels();
        megaChat._joinDialogIsShown = false;
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    render() {
        const { view, ephemeralDialog } = this.state;
        return (
            <utils.RenderTo element={document.body}>
                <div className={Join.NAMESPACE}>
                    {this.Head()}
                    {this.View(view)}
                    {ephemeralDialog && <this.Ephemeral />}
                </div>
            </utils.RenderTo>
        );
    }
}
