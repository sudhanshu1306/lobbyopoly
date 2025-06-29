/* eslint-disable react/jsx-no-useless-fragment */
// Vendor imports
import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import useWebSocket from 'react-use-websocket';

// Local imports
import {
  defaultGlobalState,
  GlobalActionDispatchContext,
  globalActionReducer,
  GlobalStateContext,
  GlobalStateAction,
} from '../utils/state';
import { makeRequest } from '../api/APIUtils';
import { Lobby, WSMessage, WSMessageType } from '../api/APITypes';

function shouldReconnect() {
  return true;
}

export function StateManager({ children }: PropsWithChildren) {
  // Reducer for handling all global actions
  const [globalState, globalStateDispatch] = useReducer(
    globalActionReducer,
    defaultGlobalState,
  );

  // When a new socket is opened, wipe the events array.
  const socketOpenHandler = useCallback(() => {
    console.log('SOCKET OPENED');
    globalStateDispatch({
      type: GlobalStateAction.UPDATE_STATE,
      state: { events: [] },
    });
  }, []);

  const socketUri = globalState.lobbyId
    ? `${
        (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
        window.location.host
      }/events/${globalState.lobbyId}`
    : null;

  const { lastJsonMessage } = useWebSocket(socketUri, {
    onOpen: socketOpenHandler,
    shouldReconnect,
  });

  const currentPlayerId = useRef<string>();
  useEffect(() => {
    currentPlayerId.current = globalState.currentPlayer?.id.$oid;
  }, [globalState.currentPlayer]);

  // When messages are received, decode them and store the data in the state
  useEffect(() => {
    if (lastJsonMessage) {
      const message = lastJsonMessage as unknown as WSMessage;

      // If a kick message was received, reset the state
      if (message.type === WSMessageType.Kick) {
        if (
          !message.player ||
          message.player?.$oid === currentPlayerId.current
        ) {
          globalStateDispatch({
            type: GlobalStateAction.RESET_STATE,
          });
        }
      }

      // If an update message was received, update the event and lobby state
      else if (message.type === WSMessageType.Update) {
        globalStateDispatch({
          type: GlobalStateAction.ADD_EVENTS,
          events: message.payload.events,
        });

        globalStateDispatch({
          type: GlobalStateAction.UPDATE_LOBBY,
          lobby: message.payload.lobby,
        });
      }
    }
  }, [lastJsonMessage]);

  // const [websocketConnection, setWebsocketConnection] = useState<WebSocket>();

  // useEffect(() => {
  //   // In development, the Create React App server doesn't properly proxy websocket connections
  //   let socketUri: string;
  //   if (process.env.NODE_ENV === 'production') {
  //     socketUri = `${
  //       window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  //     }${window.location.host}/socket`;
  //   } else {
  //     socketUri = 'ws://192.168.1.1:5000/socket';
  //   }

  //   // Create the websocket connection
  //   setWebsocketConnection((currentConnection) => {
  //     if (!currentConnection) {
  //       return new WebSocket(socketUri);
  //     }
  //     return undefined;
  //   });

  //   // On cleanup, close any existing connection and clear the state var
  //   return () => {
  //     setWebsocketConnection((currentConnection) => {
  //       currentConnection?.close();
  //       return undefined;
  //     });
  //   };
  // }, []);

  // On component mount, begin fetch of preflight data
  React.useEffect(() => {
    (async () => {
      globalStateDispatch({
        type: GlobalStateAction.PAGE_LOADING_START,
      });

      const resp = await makeRequest('get', '/api/preflight');

      // If there is no error, set the data and player id and leave
      // the preloader going.
      if (!resp.error) {
        globalStateDispatch({
          type: GlobalStateAction.UPDATE_STATE,
          state: {
            preflight: resp.payload,
            lobbyId: resp.payload.lobbyId,
            playerId: resp.payload.playerId,
          },
        });
      }

      // TODO: handle errors

      globalStateDispatch({
        type: GlobalStateAction.PAGE_LOADING_STOP,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log('GLOBAL STATE', globalState);

  return (
    <GlobalStateContext.Provider value={globalState}>
      <GlobalActionDispatchContext.Provider value={globalStateDispatch}>
        {children}
      </GlobalActionDispatchContext.Provider>
    </GlobalStateContext.Provider>
  );
}
