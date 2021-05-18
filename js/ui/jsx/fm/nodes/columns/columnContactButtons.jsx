import {Button} from "../../../../buttons.jsx";
import {Dropdown} from "../../../../dropdowns.jsx";
import ContextMenu from "../../../../../chat/ui/contactsPanel/contextMenu.jsx";
import React from "react";
import {GenericNodePropsComponent} from "../genericNodePropsComponent";

export class ColumnContactButtons extends GenericNodePropsComponent {
    static sortable = true;
    static id = "grid-url-header-nw";
    static label = "";
    static megatype = "grid-url-header-nw";

    render() {
        let {nodeAdapter} = this.props;
        let {node, selected} = nodeAdapter.props;
        let handle = node.h;

        return <td megatype={ColumnContactButtons.megatype} className={ColumnContactButtons.megatype}>
            <div className="contact-item">
                <div className="contact-item-controls">
                    <Button
                        className="mega-button action simpletip"
                        icon="sprite-fm-mono icon-chat"
                        attrs={{ 'data-simpletip': l[8632] }}
                        onClick={() => loadSubPage('fm/chat/p/' + handle)}
                    />
                    <Button
                        className="mega-button action simpletip"
                        icon="sprite-fm-mono icon-folder-outgoing-share"
                        attrs={{ 'data-simpletip': l[5631] }}
                        onClick={() => openCopyShareDialog(handle)}
                    />
                    <Button
                        ref={node => {
                            this.props.onContextMenuRef(handle, node);
                        }}
                        className="mega-button action contact-more"
                        icon="sprite-fm-mono icon-options">
                        <Dropdown
                            className="context"
                            noArrow={true}
                            positionMy="left bottom"
                            positionAt="right bottom"
                            positionLeft={this.props.contextMenuPosition || null}
                            horizOffset={4}
                            onActiveChange={opened => {
                                this.props.onActiveChange(opened);
                            }}>
                            <ContextMenu
                                contact={node}
                                selected={selected}
                                withProfile={true}
                            />
                        </Dropdown>
                    </Button>
                </div>
            </div>
        </td>;
    }
}
