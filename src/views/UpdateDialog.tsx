import * as React from 'react';
import { IReleaseMap } from '../types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { DropdownButton, MainContext, Modal, tooltip } from 'vortex-api';
import { MenuItem } from 'react-bootstrap';

export interface IBaseProps {
  releaseMap: IReleaseMap;
  onConfirm: (tag: string) => void;
  onClose: () => void;
}

export interface IConnectedProps {
  showUpdateDialog: boolean;
}

type IProps = IBaseProps;

export default function ValheimUpdateDialog(props: IProps) {
  const { onClose, onConfirm, releaseMap } = props;
  const { t } = useTranslation();
  const [selectedTag, setSelectedTag] = React.useState<string | undefined>(undefined);
  const context = React.useContext(MainContext);
  const { showUpdateDialog } = useSelector(mapStateToProps);


  // Function to handle tag selection
  const handleTagSelect = (val: any) => {
    const selectedTag = val;
    setSelectedTag(selectedTag);
  };

  const confirm = React.useCallback(() => {
    if (selectedTag) {
      onConfirm(selectedTag);
    } else {
      context.api.showErrorNotification('Update failed', 'You did not select a version', { allowReport: false });
      onClose();
    }
  }, [context, onConfirm, selectedTag]);
  const cancel = React.useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal show={showUpdateDialog} onHide={onClose} id='valheim-update-dialog'>
      <Modal.Header>
        <Modal.Title>{t('Update Valheim BepInEx Payload')}</Modal.Title>
        <Modal.Body>
          <p>{t('Select the version of BepInEx you want to switch to.')}</p>
          <DropdownButton
            title={!!selectedTag ? selectedTag : t('Select version')}
            id='valheim-update-dialog-dropdown'
            onSelect={handleTagSelect}>
            {releaseMap && Object.keys(releaseMap).map((tag) => (
              <MenuItem key={tag} eventKey={tag}>
                {tag}
              </MenuItem>
            ))}
          </DropdownButton>
        </Modal.Body>
        <Modal.Footer>
          <tooltip.Button
            tooltip={t('Switch to the selected BepInEx version')}
            onClick={confirm}
          >
            {t('Confirm')}
          </tooltip.Button>
          <tooltip.Button
            tooltip={t('Abort update and close dialog')}
            onClick={cancel}
          >
            {t('Cancel')}
          </tooltip.Button>
        </Modal.Footer>
      </Modal.Header>
    </Modal>
  );
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    showUpdateDialog: state.session.valheim.showUpdateDialog,
  };
}