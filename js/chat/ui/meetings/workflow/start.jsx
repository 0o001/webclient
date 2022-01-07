import React from 'react';
import { MegaRenderMixin } from '../../../mixins';
import ModalDialogsUI from '../../../../ui/modalDialogs.jsx';
import Button from '../button.jsx';
import Preview from './preview.jsx';

export class Start extends MegaRenderMixin {
    static NAMESPACE = 'start-meeting';

    static CLASS_NAMES = {
        EDIT: 'call-title-edit',
        INPUT: 'call-title-input'
    };

    static STREAMS = {
        AUDIO: 1,
        VIDEO: 2
    };

    inputRef = React.createRef();

    state = {
        audio: false,
        video: false,
        editing: false,
        previousTopic: undefined,
        topic: undefined
    };

    constructor(props) {
        super(props);
        this.state.topic = l.default_meeting_topic.replace('%NAME', M.getNameByHandle(u_handle));
    }

    handleChange = ev => this.setState({ topic: ev.target.value });

    toggleEdit = () =>
        this.setState(
            state => ({ editing: !state.editing, previousTopic: state.topic }),
            () => onIdle(this.doFocus)
        );

    doFocus = () => {
        if (this.state.editing) {
            const input = this.inputRef.current;
            input.focus();
            input.setSelectionRange(0, input.value.length);
        }
    };

    doReset = () => this.setState(state => ({ editing: false, topic: state.previousTopic, previousTopic: undefined }));

    bindEvents = () =>
        $(document)
            .rebind(`mousedown.${Start.NAMESPACE}`, ev => {
                if (
                    this.state.editing &&
                    !ev.target.classList.contains(Start.CLASS_NAMES.EDIT) &&
                    !ev.target.classList.contains(Start.CLASS_NAMES.INPUT)
                ) {
                    this.toggleEdit();
                }
            })
            .rebind(`keyup.${Start.NAMESPACE}`, ({ keyCode }) => {
                if (this.state.editing) {
                    const [ENTER, ESCAPE] = [13, 27];
                    return keyCode === ENTER ? this.toggleEdit() : keyCode === ESCAPE ? this.doReset() : null;
                }
            });

    Input = () =>
        <input
            type="text"
            ref={this.inputRef}
            className={Start.CLASS_NAMES.INPUT}
            value={this.state.topic}
            onChange={this.handleChange}
        />;

    onStreamToggle = (audio, video) => this.setState({ audio, video });

    startMeeting = () => {
        const { onStart } = this.props;
        const { topic, audio, video } = this.state;

        if (onStart) {
            onStart(topic, audio, video);
        }
    }

    componentDidMount() {
        super.componentDidMount();
        this.bindEvents();
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        $(document).unbind(`.${Start.NAMESPACE}`);
    }

    render() {
        const { NAMESPACE, CLASS_NAMES } = Start;
        const { editing, topic } = this.state;

        return (
            <ModalDialogsUI.ModalDialog
                {...this.state}
                name={NAMESPACE}
                className={NAMESPACE}
                stopKeyPropagation={editing}
                onClose={() => this.props.onClose()}>
                <div className={`${NAMESPACE}-preview`}>
                    <Preview onToggle={this.onStreamToggle} />
                </div>
                <div className="fm-dialog-body">
                    <div className={`${NAMESPACE}-title`}>
                        {editing ? <this.Input /> : <h2 onClick={this.toggleEdit}>{topic}</h2>}
                        <Button
                            className={`
                                mega-button
                                action
                                small
                                ${CLASS_NAMES.EDIT}
                                ${editing ? 'editing' : ''}
                            `}
                            icon="icon-rename"
                            simpletip={{ label: l[1342] /* `Edit` */, position: 'top' }}
                            onClick={this.toggleEdit}>
                            <span>{l[1342] /* `Edit` */}</span>
                        </Button>
                    </div>
                    <Button
                        className="mega-button positive large start-meeting-button"
                        onClick={this.startMeeting}>
                        <span>{l[7315] /* `Start` */}</span>
                    </Button>
                    <a href="/securechat" className="clickurl">
                        {l.how_meetings_work /* `Learn more about MEGA Meetings` */}
                    </a>
                </div>
            </ModalDialogsUI.ModalDialog>
        );
    }
}
