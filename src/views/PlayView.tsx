// Vendor imports
import { Box, Button, Text, ThemeContext, Spinner } from 'grommet';
import * as polished from 'polished';
import React, { PropsWithChildren, useCallback, useMemo } from 'react';
import reactStringReplace from 'react-string-replace';
import styled, { css } from 'styled-components';
import { Send } from 'grommet-icons';
import dayjs from 'dayjs';

// Local imports
import PlayerAvatar, { EntityAvatar } from '../components/Avatars';
import VerticalSpacer from '../components/VerticalSpacer';
import { GlobalStateContext } from '../utils/state';
import useTransferLayer from '../layers/TransferLayer';
import { Event } from '../api/APITypes';

// Asset imports
import { ReactComponent as BankIcon } from '../assets/icons/noun-bank-1010504.svg';
import { ReactComponent as FPIcon } from '../assets/icons/noun-parking-2884387.svg';

const LobbyInfoLineSpacer = styled.span`
  flex-grow: 1;
  display: inline-block;
`;

const LobbyInfoLine = styled(Text)`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;

  > em {
    margin-left: 0.5rem;
    border-radius: 2em;
    height: 1.3em;
    padding: 0.15em 0.5em;

    background: ${(props) => props.theme.global.colors.brandAlt};

    font-style: normal;
    color: ${(props) => props.theme.global.colors.text.dark};
  }

  > u {
    margin-left: 0.618ch;
  }
`;

const LogBoxInnerContainer = styled.div`
  overflow-x: auto;

  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 85%,
    rgba(0, 0, 0, 0)
  );

  > ul {
    margin-top: calc(${(props) => props.theme.global.spacing} / 6);
    margin-bottom: calc(${(props) => props.theme.global.spacing} / 2);
    padding-left: calc(${(props) => props.theme.global.spacing} * 0.8);

    font-size: 1rem;
    list-style-type: square;
  }
`;

const LogBox = styled(Box)`
  border: 1px solid ${polished.darken(0.1, '#e87024')};
  border-radius: 2px;
  max-height: 40vh;

  background: #e87024;
`;

const CenteredSpinner = styled(Spinner)`
  margin: ${(props) => props.theme.global.spacing} auto;
`;

// Styles shared between all the cards
const SharedCardStyles = styled(Box)`
  border: 1px solid ${polished.darken(0.1, '#cae8e0')};
  border-radius: 2px;
  margin-bottom: calc(${(props) => props.theme.global.spacing} / 2);
`;

SharedCardStyles.defaultProps = {
  pad: 'small',
  elevation: 'small',
};

const MoneyCardContainer = styled(SharedCardStyles)`
  display: grid;

  grid-template:
    min-content / 3rem auto minmax(auto, min-content)
    2rem;
  grid-gap: calc(${(props) => props.theme.global.spacing} / 4);
  grid-column-gap: calc(${(props) => props.theme.global.spacing} / 2);
  justify-items: left;
  align-items: center;

  background: #cae8e0;

  > h3 {
    margin: 0;
  }
`;

const PlayerNameContainer = styled.div`
  display: flex;
  flex-direction: row;

  width: 100%;
  min-width: 0;
  max-width: 100%;
`;

const PlayerNameLabel = styled.label`
  white-space: nowrap;
  overflow-x: hidden;
  text-overflow: ellipsis;
  overflow-y: hidden;

  font-size: 1.25rem;
  font-weight: 600;
  /* mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 85%, rgba(0, 0, 0, 0)); */
`;

const DottedSpacer = styled.hr`
  flex-grow: 1;

  border: 0;
  border-top: 4px dotted
    ${(props) => polished.lighten(0.382, props.theme.global.colors.text.light)};
  margin-left: calc(${(props) => props.theme.global.spacing} / 2);
  /* width: calc(100% - ${(props) => props.theme.global.spacing} / 2); */
  /* min-width: 1rem; */
`;

function PlayerName({ children }: { children: string }): JSX.Element {
  return (
    <PlayerNameContainer>
      <PlayerNameLabel title={children}>{children}</PlayerNameLabel>
      <DottedSpacer />
    </PlayerNameContainer>
  );
}

const NoTransferDot = styled.div`
  border-radius: 0.5rem;
  /* margin: 0.618rem 0.5rem 0; */
  margin: 0.5rem;
  width: 1rem;
  height: 1rem;

  background: ${(props) =>
    polished.darken(0.1, props.theme.global.colors.monopolyPaleGreen)};
`;

const TransferButton = styled(Button)`
  width: 2rem;
  height: 2rem;
`;

const BalanceBox = styled.div<{ currency: string; plain?: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  box-sizing: border-box;
  position: relative;

  font-size: 1.25rem;
  padding: calc(${(props) => props.theme.global.spacing} / 6);
  font-family: 'IBM Plex Mono', monospace;

  padding-left: 0.618em;

  ${(props) =>
    props.plain &&
    css`
      background: transparent;
      border-bottom: none;
    `}

  ::before {
    display: block;
    content: '${(props) => props.currency}';

    font-size: 0.618em;

    position: absolute;
    top: 0;
    left: 2px;
  }
`;

interface BalanceLineProps {
  icon: JSX.Element;
  name: string;
  balance: number | null;
  isTransferable: boolean;
  onTransfer?: (entity: string) => void;
  transferEntity?: string;
}

/** This component is a single line with a player/entity card */
function BalanceLine({
  icon,
  name,
  balance,
  isTransferable,
  onTransfer,
  transferEntity,
}: BalanceLineProps): JSX.Element {
  const globalState = React.useContext(GlobalStateContext);

  const onClickTransfer = useCallback(
    () => onTransfer?.(transferEntity ?? ''),
    [onTransfer, transferEntity],
  );

  let balanceText = balance?.toString() ?? '???';
  if (balance === Infinity) balanceText = '∞';

  return (
    <>
      {icon}
      <PlayerName>{name}</PlayerName>
      {/* <DottedSpacer /> */}
      <BalanceBox currency={globalState?.lobby?.options.currency ?? ''}>
        {balanceText}
      </BalanceBox>
      {isTransferable ? (
        <TransferButton
          pad="none"
          icon={<Send />}
          plain={false}
          onClick={onClickTransfer}
        />
      ) : (
        <NoTransferDot />
      )}
    </>
  );
}

const SeparatorRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;

  margin-bottom: 2px;
  width: 100%;
  text-align: center;
  color: ${(props) => props.theme.global.colors.text.light};
  font-family: 'IBM Plex Serif', serif;
  font-size: 0.8rem;
  line-height: 1em;

  > hr {
    flex-grow: 1;
    border: 0;
    border-top: 1px solid ${(props) => props.theme.global.colors.text.light};
    margin: 0 calc(${(props) => props.theme.global.spacing} / 2);
    margin-top: 2px;
  }
`;

const GridAlignedSeparatorRow = styled(SeparatorRow)<{ spacing?: boolean }>`
  grid-column: 1 / span 4;

  ${(props) =>
    props.spacing &&
    css`
      margin-top: calc(${props.theme.global.spacing} / 2);
    `}
`;

interface PlayersCardSeparatorProps {
  spacing?: boolean;
}

function PlayersCardSeparator({
  spacing,
  children,
}: PropsWithChildren<PlayersCardSeparatorProps>): JSX.Element {
  return (
    <GridAlignedSeparatorRow spacing={spacing}>
      <hr />
      <em>{children}</em>
      <hr />
    </GridAlignedSeparatorRow>
  );
}

interface BalancesCardProps {
  onTransfer: (entity: string) => void;
}

/** Component for a card representing the current player. */
function BalancesCard({ onTransfer }: BalancesCardProps): JSX.Element {
  const globalState = React.useContext(GlobalStateContext);

  const { currentPlayer } = globalState;
  const currentPlayerIsBanker =
    currentPlayer?.id.$oid === globalState.lobby?.banker.$oid;

  const otherPlayers = (globalState.lobby?.players ?? [])
    .filter((ply) => ply.id.$oid !== globalState.currentPlayer?.id.$oid)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <MoneyCardContainer>
      <PlayersCardSeparator>you</PlayersCardSeparator>
      <BalanceLine
        icon={
          <PlayerAvatar
            player={currentPlayer}
            size={48}
            outline
            crown={currentPlayerIsBanker}
          />
        }
        name={currentPlayer?.name ?? ''}
        balance={currentPlayer?.balance ?? 0}
        isTransferable
        onTransfer={onTransfer}
        transferEntity={globalState.preflight.transferEntityMap.SELF}
      />

      {otherPlayers.length > 0 && (
        <PlayersCardSeparator spacing>other players</PlayersCardSeparator>
      )}

      {otherPlayers.map((ply) => (
        <BalanceLine
          key={ply.id.$oid}
          icon={
            <PlayerAvatar
              player={ply}
              size={32}
              outline
              crown={ply.id.$oid === globalState?.lobby?.banker.$oid}
            />
          }
          name={ply.name ?? ''}
          balance={ply.balance ?? null}
          isTransferable={false}
          // TODO: implement other player transfers for banker
          // isTransferable={currentPlayerIsBanker}
          // onTransfer={onTransfer}
          // transferEntity={ply._id.$oid}
        />
      ))}

      <PlayersCardSeparator spacing>institutions</PlayersCardSeparator>

      {/* The bank */}
      <BalanceLine
        icon={
          <EntityAvatar size={32}>
            <BankIcon />
          </EntityAvatar>
        }
        name="The Bank"
        balance={
          globalState.lobby?.options.unlimitedBank
            ? Infinity
            : globalState.lobby?.bank ?? 0
        }
        isTransferable={currentPlayerIsBanker}
        onTransfer={onTransfer}
        transferEntity={globalState.preflight.transferEntityMap.BANK}
      />

      {/* Free parking */}
      <BalanceLine
        icon={
          <EntityAvatar size={32}>
            <FPIcon />
          </EntityAvatar>
        }
        name="Free Parking"
        balance={globalState.lobby?.freeParking ?? 0}
        isTransferable={currentPlayerIsBanker}
        onTransfer={onTransfer}
        transferEntity={globalState.preflight.transferEntityMap.FP}
      />
    </MoneyCardContainer>
  );
}

export default function PlayView() {
  // Global state reducer
  const globalState = React.useContext(GlobalStateContext);

  // Call transfer layer hook
  const [startTransfer, transferLayerComponent] = useTransferLayer();

  const formatEvent = useCallback(
    (event: Event) => {
      const eventText = globalState.preflight.bundleMap[event.key];
      return eventText === undefined
        ? event.key
        : reactStringReplace(eventText, /\{(\d+)\}/g, (match, i) => {
            const idx = parseInt(match, 10);
            const insert = event.inserts[idx];

            // Index MAY not exist if server code has changed
            if (insert !== undefined) {
              // Arrays are processed as special types
              if (Array.isArray(insert)) {
                const [insertKind, insertValueRaw] = insert;
                let insertValue: number | string;
                if (insertKind === 'player') {
                  insertValue = insertValueRaw.$oid;
                } else {
                  insertValue = insertValueRaw;
                }

                const ply = globalState.lobby?.players.filter(
                  (plyX) => plyX.id.$oid === insertValue,
                )[0];

                switch (insertKind) {
                  // Player inserts should lookup and return player name
                  case 'player':
                    return (
                      <u key={i}>{ply ? ply.name : <em>disconnected</em>}</u>
                    );

                  // Common inserts should look up the string from the bundle
                  case 'bundle':
                    return (
                      <u key={i}>
                        {globalState.preflight.bundleMap[insertValue]}
                      </u>
                    );

                  // Currency bundles just need the right currency symbol
                  case 'currency':
                    return (
                      <u key={i}>
                        {globalState.lobby?.options.currency}
                        {insertValue}
                      </u>
                    );

                  // Else, just try and jsonify the value
                  default:
                    return <u key={i}>{JSON.stringify(insertValue)}</u>;
                }

                // If it's not an object, just try returning it (it's prolly a string)
              } else {
                return <u key={i}>{insert}</u>;
              }
            }

            return undefined;
          });
    },
    [globalState],
  );

  // const isBanker = globalState.playerId === globalState.lobby?.banker.$oid;

  const expiresLine = useMemo(
    () =>
      globalState.lobby?.expires
        ? dayjs(globalState.lobby.expires.$date).fromNow()
        : '',
    [globalState.lobby?.expires],
  );

  return (
    <>
      {/* Insert the rendered transfer layer */}
      {transferLayerComponent}

      {/* Show the lobby code */}
      <LobbyInfoLine>
        Lobby expires {expiresLine}
        <LobbyInfoLineSpacer />
        join code is<em>{globalState.lobby?.code}</em>
      </LobbyInfoLine>
      <VerticalSpacer factor={0.382} />

      <BalancesCard onTransfer={startTransfer} />
      {/* <BalanceEntityCard onTransfer={startTransfer} /> */}

      {/* Modify the theme to insert the event log */}
      <ThemeContext.Extend
        value={{ global: { colors: { text: { light: '#222222' } } } }}
      >
        {(globalState.events?.length ?? 0) > 0 ? (
          <LogBox pad="small" elevation="small">
            <LogBoxInnerContainer>
              {/* <h4>Event Log</h4> */}
              <SeparatorRow>
                <hr />
                <em>events</em>
                <hr />
              </SeparatorRow>
              <ul>
                {[...(globalState.events ?? [])].reverse().map((event) => (
                  <li key={event.id.$oid}>{formatEvent(event)}</li>
                ))}
              </ul>
            </LogBoxInnerContainer>
          </LogBox>
        ) : (
          <CenteredSpinner />
        )}
      </ThemeContext.Extend>
    </>
  );
}
