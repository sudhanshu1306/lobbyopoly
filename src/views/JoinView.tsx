// Vendor imports
import { Button, CheckBox, FormField, Select, TextInput } from 'grommet';
import React from 'react';
import styled from 'styled-components';

// Local imports
import BulletedInstruction from '../components/BulletedInstruction';
import VerticalSpacer from '../components/VerticalSpacer';
import {
  GlobalStateContext,
  GlobalActionDispatchContext,
  GlobalStateAction,
} from '../utils/state';
import {
  CreateLobbyRequest,
  CreateLobbyResponse,
  JoinLobbyResponse,
} from '../api/APITypes';
import * as api from '../api/APIUtils';

const ErrorText = styled.p`
  color: ${(props) => props.theme.global.colors['status-error']};
`;

const AlignedCheckBoxContainer = styled.div`
  margin-left: calc(${(props) => props.theme.global.spacing} * 1.5);
`;

const AlignedFormField = styled(FormField)`
  margin: 0 0 0 calc(${(props) => props.theme.global.spacing} * 1.5);
`;

enum LobbyJoinMode {
  NONE = 'NONE',
  JOIN = 'JOIN',
  CREATE = 'CREATE',
}

export default function JoinView() {
  // Global state reducer
  const globalState = React.useContext(GlobalStateContext);
  const globalDispatch = React.useContext(GlobalActionDispatchContext);

  // Local state vars
  const [joinMode, setJoinMode] = React.useState(LobbyJoinMode.NONE);
  const [joinCode, setJoinCode] = React.useState('');
  const [joinName, setJoinName] = React.useState('');
  const [joinError, setJoinError] = React.useState(undefined);
  const [gameOptions, setGameOptions] = React.useState({
    unlimitedBank: true,
    freeParking: false,
    hideBalances: true,
    maxPlayers: 8,
    bankBalance: 20580, // The original game came with $15140
    startingBalance: 40000,
    currency: '$',
  });

  // Join form event handlers
  const handleChangeJoinCode: React.ChangeEventHandler<HTMLInputElement> = (
    ev,
  ) => setJoinCode(ev.target.value);
  const handleChangeJoinName: React.ChangeEventHandler<HTMLInputElement> = (
    ev,
  ) => setJoinName(ev.target.value);
  const handleClickJoinLobby = async () => {
    // Clear errors and set page loading
    setJoinError(undefined);
    globalDispatch({ type: GlobalStateAction.PAGE_LOADING_START });

    let code: string = joinCode;

    // If we're creating a new lobby, hit that API first
    if (joinMode === LobbyJoinMode.CREATE) {
      const createResponse = await api.makeRequest<
        CreateLobbyRequest,
        CreateLobbyResponse
      >('post', '/api/create', gameOptions);
      if (createResponse.error) {
        const errorText =
          globalState.preflight.bundleMap[createResponse.error] ||
          createResponse.error;
        setJoinError(errorText);
        return;
      }
      code = createResponse.payload?.code ?? '';
    }

    // Hit the API to join/create lobby
    const resp = await api.makeRequest('post', '/api/join', {
      code,
      name: joinName,
    });

    // If there's an error, surface it to the user
    if (resp.error) {
      const errorText =
        globalState.preflight.bundleMap[resp.error] || resp.error;
      setJoinError(errorText);
    }

    // Else, store the user ID
    else {
      globalDispatch({
        type: GlobalStateAction.UPDATE_STATE,
        state: {
          lobbyId: resp.payload.lobby,
          playerId: resp.payload.player,
        },
      });
    }

    globalDispatch({ type: GlobalStateAction.PAGE_LOADING_STOP });
  };

  // Event handler for changing game options
  const handleOptionChange = React.useCallback((event: any) => {
    // If this is a synthetic event, persist it so as to not
    // risk the event disappearing before the state setter callbacks are invoked
    if (event.persist) {
      event.persist();
    }

    const key = event.target.dataset.optionKey;
    switch (key) {
      case 'unlimitedBank':
      case 'freeParking':
      case 'hideBalances':
        setGameOptions((prevOptions) => ({
          ...prevOptions,
          [key]: event.target.checked,
        }));
        break;

      case 'maxPlayers':
      case 'bankBalance':
      case 'startingBalance':
        setGameOptions((prevOptions) => ({
          ...prevOptions,
          [key]: event.target.value ? parseInt(event.target.value, 10) : '',
        }));
        break;

      case 'currency':
        setGameOptions((prevOptions) => ({
          ...prevOptions,
          [key]: event.option,
        }));
        break;

      default:
        break;
    }
  }, []);

  return (
    <>
      {/* Content switcher for joining vs creating */}
      <BulletedInstruction n="1">What do you want to do?</BulletedInstruction>

      <VerticalSpacer factor={1} />

      <Button
        label="Join a lobby"
        active={joinMode === LobbyJoinMode.JOIN}
        onClick={() => setJoinMode(LobbyJoinMode.JOIN)}
      />
      <VerticalSpacer factor={0.382} />
      <Button
        label="Create a new lobby"
        active={joinMode === LobbyJoinMode.CREATE}
        onClick={() => setJoinMode(LobbyJoinMode.CREATE)}
      />

      {joinMode !== LobbyJoinMode.NONE && (
        <>
          <VerticalSpacer factor={1} />
          <hr style={{ margin: '0' }} />
          <VerticalSpacer factor={1} />
        </>
      )}

      {joinMode === LobbyJoinMode.JOIN && (
        <>
          <BulletedInstruction n="2">
            To join a lobby, just enter the lobby code below, enter your name,
            and press the button.
          </BulletedInstruction>
          <VerticalSpacer factor={1} />
          <TextInput
            placeholder="Lobby code"
            value={joinCode}
            onChange={handleChangeJoinCode}
            type="tel"
          />
          <VerticalSpacer factor={0.382} />
          <TextInput
            placeholder="Your name"
            value={joinName}
            onChange={handleChangeJoinName}
          />
          <VerticalSpacer />
          <Button
            primary
            label="Join Lobby"
            onClick={handleClickJoinLobby}
            disabled={!(joinCode && joinName)}
          />
        </>
      )}

      {joinMode === LobbyJoinMode.CREATE && (
        <>
          <BulletedInstruction n="2">
            To create a lobby, you must first choose your game options.
          </BulletedInstruction>
          <VerticalSpacer factor={1} />

          <AlignedCheckBoxContainer>
            <CheckBox
              reverse
              label="Unlimited bank funds:"
              data-option-key="unlimitedBank"
              checked={gameOptions.unlimitedBank}
              onChange={handleOptionChange}
            />
          </AlignedCheckBoxContainer>

          <VerticalSpacer factor={0.382} />

          <AlignedCheckBoxContainer>
            <CheckBox
              reverse
              label="Free parking account:"
              data-option-key="freeParking"
              checked={gameOptions.freeParking}
              onChange={handleOptionChange}
            />
          </AlignedCheckBoxContainer>

          <VerticalSpacer factor={0.382} />

          <AlignedCheckBoxContainer>
            <CheckBox
              reverse
              label="Hide other players' funds:"
              data-option-key="hideBalances"
              checked={gameOptions.hideBalances}
              onChange={handleOptionChange}
            />
          </AlignedCheckBoxContainer>

          <VerticalSpacer factor={0.382} />

          <AlignedFormField label="Maximum number of players:">
            <TextInput
              placeholder="type here"
              type="number"
              data-option-key="maxPlayers"
              value={gameOptions.maxPlayers}
              onChange={handleOptionChange}
            />
          </AlignedFormField>

          <VerticalSpacer factor={0.382} />

          <AlignedFormField label="Bank total funds:">
            <TextInput
              placeholder="type here"
              type="number"
              data-option-key="bankBalance"
              value={gameOptions.bankBalance}
              onChange={handleOptionChange}
              disabled={gameOptions.unlimitedBank}
            />
          </AlignedFormField>

          <VerticalSpacer factor={0.382} />

          <AlignedFormField label="Player starting balance:">
            <TextInput
              placeholder="type here"
              type="number"
              data-option-key="startingBalance"
              value={gameOptions.startingBalance}
              onChange={handleOptionChange}
            />
          </AlignedFormField>

          <VerticalSpacer factor={0.382} />

          <AlignedFormField label="Game currency:">
            <Select
              options={['$', '£']}
              data-option-key="currency"
              value={gameOptions.currency}
              onChange={handleOptionChange}
            />
          </AlignedFormField>

          <VerticalSpacer factor={1} />
          <hr style={{ margin: '0' }} />
          <VerticalSpacer factor={1} />

          <BulletedInstruction n="3">
            Then, just enter your name below and press the button.
          </BulletedInstruction>
          <VerticalSpacer factor={1} />
          <TextInput
            placeholder="Your name"
            value={joinName}
            onChange={handleChangeJoinName}
          />
          <VerticalSpacer />
          <Button
            primary
            label="Create Lobby"
            onClick={handleClickJoinLobby}
            disabled={!joinName}
          />
        </>
      )}

      {joinError && <ErrorText>{joinError}</ErrorText>}
    </>
  );
}
