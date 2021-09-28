import React from 'react';
import { MegaRenderMixin } from '../../../../stores/mixins';
import Call from '../call.jsx';

export default class Loading extends MegaRenderMixin {
    static NAMESPACE = 'meetings-loading'

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        super.componentDidMount();
        // Close dropdown elements, popups
        document.dispatchEvent(new Event('closeDropdowns'));
        closeDialog?.();
        notify?.closePopup();
        alarm?.hideAllWarningPopups();
        document.querySelectorAll('.js-dropdown-account').forEach(({ classList }) =>
            classList.contains('show') && classList.remove('show')
        );
    }

    renderDebug = () => {
        const { chatRoom } = this.props;
        if (chatRoom && chatRoom.sfuApp) {
            return (
                <div className={`${Loading.NAMESPACE}-debug`}>
                    <div>callId: {chatRoom.sfuApp.callId}</div>
                    <div>roomId: {chatRoom.sfuApp.room.roomId}</div>
                    <div>isMeeting: {chatRoom.sfuApp.room.isMeeting ? 'true' : 'false'}</div>
                </div>
            );
        }
    };

    render() {
        const { title } = this.props;
        return (
            <div className={Loading.NAMESPACE}>
                <div className={`${Loading.NAMESPACE}-content`}>
                    <span>
                        <i className="sprite-fm-mono icon-video-call-filled" />
                    </span>
                    <h3>{title || l.starting /* `Starting` */}</h3>
                    <div className="loading-container">
                        <div className="loading-indication" />
                    </div>
                </div>
                {d && this.renderDebug()}
            </div>
        );
    }
}
