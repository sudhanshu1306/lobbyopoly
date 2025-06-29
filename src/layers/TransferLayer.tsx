// Vendor imports
import {
  Box,
  Button,
  FormField,
  Layer,
  Select,
  Text,
  SelectProps,
  ButtonProps,
} from 'grommet';
import { Revert, Send } from 'grommet-icons';
import React, { useMemo } from 'react';
import styled from 'styled-components';

// Local imports
import PlayerAvatar, { EntityAvatar } from '../components/Avatars';
import VerticalSpacer from '../components/VerticalSpacer';
import {
  GlobalStateContext,
  GlobalActionDispatchContext,
  GlobalStateAction,
} from '../utils/state';
import * as api from '../api/APIUtils';

// Asset imports
import { ReactComponent as BankIcon } from '../assets/icons/noun-bank-1010504.svg';
import { ReactComponent as FPIcon } from '../assets/icons/noun-parking-2884387.svg';

const StyledOptionBox = styled(Box)`
  display: grid;
  grid-template: 2rem / 2rem max-content;
  grid-column-gap: calc(${(props) => props.theme.global.spacing} / 4);
  align-items: center;

  > svg {
    fill: ${(props) => props.theme.global.colors.brandAlt};
  }
`;

interface TransferTarget {
  icon: JSX.Element;
  label: string;
  value: string;
}

function OptionBox({ target }: { target: TransferTarget }) {
  return (
    <StyledOptionBox pad="small">
      {target.icon}
      {target.label}
    </StyledOptionBox>
  );
}

const TransferMeter = styled(Text)`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;

  font-size: 4rem;

  > sup {
    align-self: flex-start;

    display: inline-block;

    margin-top: 0.5em;

    font-size: 0.5em;
  }

  > code {
    flex-grow: 1;

    line-height: 1em;
  }
`;

interface BillButtonProps extends ButtonProps {
  span?: number;
}

const BillButton = styled(Button)<BillButtonProps>`
  grid-column-end: span ${(props) => props.span || 1};
`;

const BillButtonMatrix = styled.div`
  display: grid;
  grid-template: 2rem auto repeat(3, 2rem) auto 2rem / 1fr 1fr 1fr;
  grid-gap: calc(${(props) => props.theme.global.spacing} / 4);

  > hr {
    grid-column-end: span 3;

    margin: calc(${(props) => props.theme.global.spacing} / 4) 0;
    border: none;
    border-bottom: 1px solid
      ${(props) => props.theme.global.colors.border.light};
    width: 100%;
  }
`;

export default function useTransferLayer(): [
  (source: string) => void,
  JSX.Element | null,
] {
  // Global state reducer
  const globalState = React.useContext(GlobalStateContext);
  const globalDispatch = React.useContext(GlobalActionDispatchContext);

  // Local state vars
  const [isOpen, setOpen] = React.useState(false);
  const [transferSource, setTransferSource] = React.useState<string>('');
  const [transferTarget, setTransferTarget] = React.useState<
    TransferTarget | undefined
  >(undefined);
  const [transferAmount, setTransferAmount] = React.useState(0);
  const [transferError, setTransferError] = React.useState<string>('');

  // Event handlers for opening and closing
  const closeHandler = React.useCallback(() => setOpen(false), []);
  const startTransfer = React.useCallback((source: string) => {
    setTransferSource(source);
    setTransferTarget(undefined);
    setTransferAmount(0);
    setTransferError('');
    setOpen(true);
  }, []);

  // Event handler for changing selection
  const handleChangeTarget: SelectProps['onChange'] = React.useCallback(
    ({ option }: any) => setTransferTarget(option),
    [],
  );

  // Function to get the source's current balance
  const getSourceBalance = () => {
    switch (transferSource) {
      case globalState.preflight.transferEntityMap.SELF:
        return globalState.currentPlayer?.balance ?? 0;
      case globalState.preflight.transferEntityMap.BANK:
        return globalState.lobby?.bank ?? 0;
      case globalState.preflight.transferEntityMap.FP:
        return globalState.lobby?.freeParking ?? 0;
      default:
        return 0;
    }
  };

  // Construct a list of targets, based on the source
  const nonPlayerSource = [
    globalState.preflight.transferEntityMap.BANK,
    globalState.preflight.transferEntityMap.FP,
  ].includes(transferSource);

  const transferTargetList: TransferTarget[] = useMemo(() => {
    const targets: TransferTarget[] = [];

    if (transferSource !== globalState.preflight.transferEntityMap.BANK) {
      targets.push({
        icon: (
          <EntityAvatar size={32}>
            <BankIcon />
          </EntityAvatar>
        ),
        label: 'The Bank',
        value: globalState.preflight.transferEntityMap.BANK,
      });
    }

    if (
      transferSource !== globalState.preflight.transferEntityMap.FP &&
      globalState.lobby?.options.freeParking
    ) {
      targets.push({
        icon: (
          <EntityAvatar size={32}>
            <FPIcon />
          </EntityAvatar>
        ),
        label: 'Free Parking',
        value: globalState.preflight.transferEntityMap.FP,
      });
    }

    globalState.lobby?.players
      .filter((ply) => ply.id.$oid !== globalState.playerId || nonPlayerSource)
      .map((ply) =>
        targets.push({
          icon: (
            <PlayerAvatar
              player={ply}
              size={32}
              outline={false}
              crown={false}
            />
          ),
          label: ply.name,
          value: ply.id.$oid,
        }),
      );

    return targets;
  }, [globalState, nonPlayerSource, transferSource]);

  const currentTarget: TransferTarget =
    transferTarget ?? transferTargetList?.[0];

  // Handler for starting sending transfer
  const handleClickSend = async () => {
    // Trigger the page loading animation
    globalDispatch({ type: GlobalStateAction.PAGE_LOADING_START });

    // Fire off the transfer request
    const transferResponse = await api.makeRequest('post', '/api/transfer', {
      source: transferSource,
      destination: currentTarget.value,
      amount: transferAmount,
    });

    // Update the transfer error
    setTransferError(transferResponse.error ?? '');

    // Stop the page loading animation
    globalDispatch({ type: GlobalStateAction.PAGE_LOADING_STOP });

    // If the transfer was successfull, close the dialog
    if (!transferResponse.error) {
      closeHandler();
    }
  };

  // Create list of money buttons
  const billButtonList = [
    {
      amount: 1,
      color: '#e3dac9',
      span: true,
    },
    {
      amount: 5,
      color: '#e5c0b8',
      span: false,
    },
    {
      amount: 10,
      color: '#e8dea9',
      span: false,
    },
    {
      amount: 20,
      color: '#95c1b2',
      span: false,
    },
    {
      amount: 50,
      color: '#9eced0',
      span: false,
    },
    {
      amount: 100,
      color: '#dec682',
      span: false,
    },
    {
      amount: 500,
      color: '#e5b42b',
      span: false,
    },
  ];

  // Render the component
  /* eslint-disable react/no-children-prop */
  const rendered = isOpen ? (
    <Layer
      margin="large"
      responsive
      full={false}
      modal
      onClickOutside={closeHandler}
      onEsc={closeHandler}
      animation="fadeIn"
    >
      <Box pad="medium">
        {/* Transfer target selection */}
        <FormField label="Select recipient">
          <Select
            options={transferTargetList.filter(
              (option) => option.value !== currentTarget.value,
            )}
            disabled={transferTargetList.length <= 1}
            value={currentTarget}
            onChange={handleChangeTarget}
            valueLabel={
              <OptionBox key={currentTarget.value} target={currentTarget} />
            }
            children={(option) => (
              <OptionBox key={option.value} target={option} />
            )}
          />
        </FormField>

        <VerticalSpacer />

        <Text>How much do you want to send?</Text>

        <TransferMeter>
          <sup>{globalState.lobby?.options.currency}</sup>
          <code>{transferAmount}</code>
          <Button icon={<Revert />} onClick={() => setTransferAmount(0)} />
        </TransferMeter>

        <VerticalSpacer />

        <BillButtonMatrix>
          <BillButton
            label={`${globalState.lobby?.options.currency}200`}
            onClick={() => setTransferAmount(200)}
            disabled={globalState.applicationLoading}
          />
          <BillButton
            label="10%"
            onClick={() =>
              setTransferAmount(Math.round(getSourceBalance() * 0.1))
            }
            disabled={globalState.applicationLoading}
          />
          <BillButton
            label="ALL"
            onClick={() => setTransferAmount(getSourceBalance())}
            disabled={globalState.applicationLoading}
          />
          <hr />
          {billButtonList.map((btn) => (
            <BillButton
              key={btn.amount}
              color={btn.color}
              primary
              label={`+${globalState.lobby?.options.currency}${btn.amount}`}
              span={btn.span ? 3 : 1}
              onClick={() => setTransferAmount((curr) => curr + btn.amount)}
              disabled={globalState.applicationLoading}
            />
          ))}
          <hr />
          <BillButton
            label="Cancel"
            onClick={closeHandler}
            disabled={globalState.applicationLoading}
          />
          <BillButton
            label="Send"
            icon={<Send />}
            reverse
            primary
            span={2}
            onClick={handleClickSend}
            disabled={globalState.applicationLoading || transferAmount <= 0}
          />
        </BillButtonMatrix>

        {/* Show transfer errors */}
        {transferError && (
          <>
            <VerticalSpacer factor={0.382} />
            <Text color="status-critical">
              {globalState.preflight.bundleMap[transferError]}
            </Text>
          </>
        )}
      </Box>
    </Layer>
  ) : null;
  /* eslint-enable react/no-children-prop */

  return [startTransfer, rendered];
}
