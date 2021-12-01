import React from 'react';
import { MegaRenderMixin } from '../../mixins';
import Call from './call.jsx';
import StreamHead from './streamHead.jsx';
import StreamNode from './streamNode.jsx';
import SidebarControls  from './sidebarControls.jsx';
import StreamControls from './streamControls.jsx';
import Local from './local.jsx';
import ParticipantsNotice from './participantsNotice.jsx';

export const STREAM_ACTIONS = { ADD: 1, REMOVE: 2 };
export const MAX_STREAMS = 19; // 19 + me -> 20

const NAMESPACE = 'stream';
const MAX_STREAMS_PER_PAGE = 9;
const PAGINATION = { PREV: 1, NEXT: 2 };
const MOUSE_OUT_DELAY = 2500;

export default class Stream extends MegaRenderMixin {
    wrapperRef = React.createRef();
    containerRef = React.createRef();

    nodeRefs = [];
    chunks = [];
    chunksLength = 0;

    lastRescaledCache = undefined;

    delayProcID = null;

    state = {
        page: 0,
        hovered: false,
        link: undefined
    };

    /**
     * movePage
     * @description Moves the current page within the carousel. Invoked by clicking on the the left/right carousel
     * controls and automatically after reducing the amount of pages.
     * @param {PAGINATION} direction
     * @see renderNodes
     * @see componentDidUpdate
     * @returns {void}
     */

    movePage = direction =>
        this.setState(state => ({ page: direction === PAGINATION.NEXT ? state.page + 1 : state.page - 1 }));

    /**
     * handleMouseMove
     * @description Mouse move event handler -- sets the `hovered` state and removes the hover delay.
     * @returns {void}
     */

    handleMouseMove = () => {
        this.setState({ hovered: true });
        if (this.delayProcID) {
            delay.cancel(this.delayProcID);
            this.delayProcID = null;
        }
    };

    /**
     * handleMouseOut
     * @description Mouse out event handler -- removes the `hovered` state and adds delay listener.
     * @returns {void}
     */

    handleMouseOut = () => {
        if (this.state.hovered) {
            this.delayProcID =
                delay(`${NAMESPACE}-hover`, () => {
                    if (this.isMounted()) {
                        // when ending a call, the component may be unmounted on hover, because of the delay ^
                        this.setState({hovered: false});
                    }
                }, MOUSE_OUT_DELAY);
        }
    };

    /**
     * getPublicLink
     * @description Retrieves the public link for the current chat room.
     * @returns {void|null}
     */

    getPublicLink = () => {
        const { call, chatRoom } = this.props;
        if (call.isPublic) {
            chatRoom.updatePublicHandle(
                undefined,
                () => this.setState({ link: chatRoom.publicLink ? `${getBaseUrl()}/${chatRoom.publicLink}` : l[20660] })
            );
        }
        return null;
    };

    /**
     * getColumns
     * @description Calculates the number of columns necessary for the grid, based on given number of streams.
     * @param {number} streamsCount the number of streams
     * @returns {number} the number of columns
     */

    getColumns = streamsCount => {
        switch (true) {
            case streamsCount === 1:
                return 1;
            case streamsCount >= 7:
                return 3;
            default:
                return 2;
        }
    };

    /**
     * chunkNodes
     * @description Takes collection of streams and returns a new collection that contains separate groups of streams
     * based on the passed chunk size. Used to construct the stream carousel.
     * @param {Array|Peers} nodes collection of stream nodes
     * @param {number} size the amount of chunks
     * @see renderNodes
     * @see MAX_STREAMS_PER_PAGE
     * @returns {Array|null}
     */

    chunkNodes = (nodes, size) => {
        if (nodes && nodes.length && size) {
            const chunked = [];
            let index = 0;
            while (index < nodes.length) {
                chunked.push(nodes.slice(index, index + size));
                index += size;
            }
            return chunked;
        }
        return null;
    };

    /**
     * scaleNodes
     * @description Handles the stream nodes scaling within the stream grid. Calculates the optimal node dimensions
     * based on the current viewport and keeps the aspect ratio of the nodes.
     * @param {number} [columns] number of grid columns
     * @param {boolean} [forced] flag indicating whether disregard the cached rescale
     * @returns {void}
     */

    scaleNodes = (columns, forced = false) => {
        const { streams, isOnHold, minimized, mode } = this.props;
        const container = this.containerRef.current;
        this.lastRescaledCache = forced ? null : this.lastRescaledCache;

        if (isOnHold || minimized || !container) {
            // No streams rendered, e.g. "On hold mode" or in minimized state
            return;
        }

        const extraVerticalMargin = 100;
        const parentRef = container.parentNode;
        const containerWidth = parentRef.offsetWidth;
        const containerHeight = parentRef.offsetHeight - extraVerticalMargin;
        const streamsInUI = streams.length > MAX_STREAMS_PER_PAGE ? this.chunks[this.state.page] : streams;

        if (streamsInUI) {
            const streamCountInUI = streamsInUI.length;
            let rows;
            if (mode === Call.MODE.THUMBNAIL) {
                columns = typeof columns === 'number' ? columns : this.getColumns(streamCountInUI);
                rows = Math.ceil(streamCountInUI / columns);
            }
            else {
                rows = 1;
                columns = 1;
            }

            let targetWidth = Math.floor(containerWidth / columns);
            let targetHeight = targetWidth / 16 * 9;
            if (targetHeight * rows > containerHeight) {
                targetHeight = Math.floor(containerHeight / rows);
                targetWidth = targetHeight / 9 * 16;
            }

            const nodeRefs = this.nodeRefs.flat();
            const nodeRefsLength = nodeRefs.length;
            const viewMode = mode || Call.MODE.SPEAKER;

            if (viewMode === Call.MODE.THUMBNAIL && columns !== 4 && (targetWidth < 160 || targetHeight < 120)) {
                return this.scaleNodes(4);
            }

            let cache =
                `${viewMode}:${targetWidth}:${targetHeight}:${nodeRefsLength}:${rows}:${streamCountInUI}:${columns}`;

            for (let i = 0; i < nodeRefsLength; i++) {
                cache += `${nodeRefs[i].cacheKey}:`;
            }


            if (this.lastRescaledCache === cache) {
                return;
            }
            this.lastRescaledCache = cache;

            for (let i = 0; i < nodeRefsLength; i++) {
                const node = nodeRefs[i];
                if (node && node.ref) {
                    node.ref.style.width = `${targetWidth}px`;
                    node.ref.style.height = `${targetHeight}px`;
                }
            }

            container.style.width = `${targetWidth * columns}px`;
        }
    };

    /**
     * renderNodes
     * @description Renders the stream nodes in different form, based on the passed state -- i) `Thumbnail` mode, where
     * all stream nodes are rendered within the main grid or on multiple grid pages with carousel behavior, as well as
     * ii) `Speaker` mode, where single stream node is rendered on full screen and the rest within the `Sidebar`.
     * @see Call.MODE
     * @see StreamHead.render
     * @see ModeSwitch
     * @returns {JSX.Element|null|Array}
     */

    renderNodes = () => {
        const {
            mode,
            streams,
            call,
            forcedLocal,
            chatRoom,
            ephemeralAccounts,
            onCallMinimize,
            onSpeakerChange,
            onThumbnailDoubleClick
        } = this.props;

        //
        //  `Thumbnail Mode`
        // -------------------------------------------------------------------------

        if (mode === Call.MODE.THUMBNAIL) {

            //
            // Default, i.e. streams aligned within single page grid.
            // ------------------------------------------------------

            if (streams.length <= MAX_STREAMS_PER_PAGE) {
                const $$STREAMS = [];
                streams.forEach(stream => {
                    const cacheKey = stream.source?.srcObject?.id;

                    $$STREAMS.push(
                        <StreamNode
                            mode={mode}
                            chatRoom={chatRoom}
                            menu={true}
                            ephemeralAccounts={ephemeralAccounts}
                            onCallMinimize={onCallMinimize}
                            onSpeakerChange={onSpeakerChange}
                            onDoubleClick={(e, streamNode) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onThumbnailDoubleClick(streamNode);
                            }}
                            key={`${mode}_${stream.clientId}_${cacheKey}`}
                            stream={stream}
                            didMount={ref => {
                                this.nodeRefs.push({ clientId: stream.clientId, cacheKey, ref });
                                this.scaleNodes(undefined, true);
                            }}
                            willUnmount={() => {
                                this.nodeRefs = this.nodeRefs.filter(
                                    nodeRef => nodeRef.clientId !== stream.clientId
                                );
                            }}
                        />
                    );
                });
                return $$STREAMS;
            }

            //
            // Carousel behavior with variable amount of pages, incl. previous/next behavior.
            // ------------------------------------------------------------------------------

            const { page } = this.state;
            this.chunks = this.chunkNodes(streams, MAX_STREAMS_PER_PAGE);
            this.chunksLength = this.chunks.length;

            return (
                <div className="carousel">
                    <div className="carousel-container">
                        {this.chunks.map((chunk, i) => {
                            return (
                                <div
                                    key={i}
                                    className={`
                                        carousel-page
                                        ${i === page ? 'active' : ''}
                                    `}>
                                    {chunk.map(stream =>
                                        <StreamNode
                                            key={stream.clientId}
                                            stream={stream}
                                            chatRoom={chatRoom}
                                            menu={true}
                                            ephemeralAccounts={ephemeralAccounts}
                                            onCallMinimize={onCallMinimize}
                                            onSpeakerChange={onSpeakerChange}
                                            didMount={ref => {
                                                if (!this.nodeRefs[i]) {
                                                    this.nodeRefs[i] = [];
                                                }
                                                this.nodeRefs[i].push({ clientId: stream.clientId, ref });
                                            }}
                                            willUnmount={() => {
                                                this.nodeRefs = this.nodeRefs.map(chunk =>
                                                    chunk.filter(nodeRef => nodeRef.clientId !== stream.clientId)
                                                );
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {page !== 0 && (
                        <button
                            className="carousel-button-prev theme-dark-forced"
                            onClick={() => this.movePage(PAGINATION.PREV)}>
                            <i className="sprite-fm-mono icon-arrow-left-thin" />
                            <div>{page + 1}/{this.chunksLength}</div>
                        </button>
                    )}
                    {page < this.chunksLength - 1 && (
                        <button
                            className="carousel-button-next theme-dark-forced"
                            onClick={() => this.movePage(PAGINATION.NEXT)}>
                            <i className="sprite-fm-mono icon-arrow-right-thin" />
                            <div>{page + 1}/{this.chunksLength}</div>
                        </button>
                    )}
                </div>
            );
        }

        //
        //  `Speaker Mode`
        // -------------------------------------------------------------------------

        const activeStream = call.getActiveStream();
        const targetStream = forcedLocal ? call.getLocalStream() : activeStream;

        return (
            forcedLocal || activeStream ?
                <StreamNode
                    key={targetStream.clientId}
                    stream={targetStream}
                    chatRoom={chatRoom}
                    menu={true}
                    ephemeralAccounts={ephemeralAccounts}
                    onCallMinimize={onCallMinimize}
                /> :
                null
        );
    };

    /**
     * renderOnHold
     * @description Renders the "on hold" state.
     * @see Call.handleHoldToggle
     * @returns {JSX.Element}
     */

    renderOnHold = () =>
        <div
            className="stream-on-hold theme-light-forced"
            onClick={this.props.onHoldClick}>
            <i className="sprite-fm-mono icon-play" />
            <span>{l[23459] /* `Resume call` */}</span>
        </div>;

    /**
     * renderStreamContainer
     * @description Wrapper function that handles the rendering of the streams container. Conditional
     * `ParticipantsNotice` is rendered if the current user is the only call participant at the moment.
     * @see ParticipantsNotice
     * @see renderNodes
     * @returns {JSX.Element}
     */

    renderStreamContainer = () => {
        const { sfuApp, call, chatRoom, streams, onInviteToggle } = this.props;
        const streamContainer = content =>
            <div
                ref={this.containerRef}
                className={`
                    ${NAMESPACE}-container
                    ${streams.length === 0 ? 'with-notice' : ''}
                `}>
                {content}
            </div>;

        if (streams.length === 0) {
            return (
                <ParticipantsNotice
                    sfuApp={sfuApp}
                    call={call}
                    chatRoom={chatRoom}
                    streamContainer={streamContainer}
                    link={this.state.link}
                    onInviteToggle={onInviteToggle}
                />
            );
        }

        return streamContainer(this.renderNodes());
    };

    specShouldComponentUpdate(nextProps) {
        if (nextProps.minimized !== this.props.minimized) {
            return true;
        }
        return null;
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        chatGlobalEventManager.removeEventListener('resize', this.getUniqueId());
        mBroadcaster.removeListener(this.callHoldListener);
    }

    componentDidMount() {
        super.componentDidMount();
        this.getPublicLink();
        this.scaleNodes();
        chatGlobalEventManager.addEventListener('resize', this.getUniqueId(), this.scaleNodes);
        this.callHoldListener = mBroadcaster.addListener('meetings:toggleHold', () => this.scaleNodes(undefined, true));
    }

    componentDidUpdate() {
        super.componentDidMount();
        this.scaleNodes();
        // Move to previous page automatically on page removal
        if (this.chunksLength > 0 && this.state.page + 1 > this.chunksLength) {
            this.movePage(PAGINATION.PREV);
        }
    }

    render() {
        const { hovered, link } = this.state;
        const {
            mode, call, chatRoom, minimized, streams, sidebar, forcedLocal, view, isOnHold, onCallMinimize,
            onCallExpand, onStreamToggle, onModeChange, onChatToggle, onParticipantsToggle, onAudioClick, onVideoClick,
            onCallEnd, onScreenSharingClick, onHoldClick, onSpeakerChange
        } = this.props;

        return (
            <div
                ref={this.wrapperRef}
                className={`
                    ${NAMESPACE}
                    ${sidebar ? '' : 'full'}
                    ${hovered ? 'hovered' : ''}
                `}
                onMouseMove={this.handleMouseMove}
                onMouseOut={this.handleMouseOut}>
                {minimized ? null : (
                    <>
                        <StreamHead
                            disableCheckingVisibility={true}
                            mode={mode}
                            call={call}
                            chatRoom={chatRoom}
                            link={link}
                            onCallMinimize={onCallMinimize}
                            onModeChange={onModeChange}
                        />

                        {isOnHold ? this.renderOnHold() : this.renderStreamContainer()}

                        <StreamControls
                            call={call}
                            onAudioClick={onAudioClick}
                            onVideoClick={onVideoClick}
                            onScreenSharingClick={onScreenSharingClick}
                            onCallEnd={onCallEnd}
                            streams={streams}
                            onStreamToggle={onStreamToggle}
                            onHoldClick={onHoldClick}
                        />

                        <SidebarControls
                            chatRoom={chatRoom}
                            streams={streams.length}
                            mode={mode}
                            view={view}
                            sidebar={sidebar}
                            onChatToggle={onChatToggle}
                            onParticipantsToggle={onParticipantsToggle}
                        />
                    </>
                )}

                <Local
                    call={call}
                    streams={streams}
                    mode={mode}
                    view={view}
                    isOnHold={isOnHold}
                    chatRoom={chatRoom}
                    minimized={minimized}
                    sidebar={sidebar}
                    forcedLocal={forcedLocal}
                    wrapperRef={this.wrapperRef}
                    onAudioClick={onAudioClick}
                    onVideoClick={onVideoClick}
                    onCallEnd={onCallEnd}
                    onScreenSharingClick={onScreenSharingClick}
                    onCallMinimize={onCallMinimize}
                    onCallExpand={async() => {
                        await onCallExpand();
                        this.scaleNodes(undefined, true);
                    }}
                    onSpeakerChange={onSpeakerChange}
                    onModeChange={onModeChange}
                />
            </div>
        );
    }
}
