// Vendor imports
import React, { PropsWithChildren } from 'react';
import styled, { css } from 'styled-components';
import * as polished from 'polished';

// Local imports
import { GlobalStateContext } from '../utils/state';
import { Player } from '../api/APITypes';

// import { ReactComponent as CrownIcon } from '../assets/icons/noun-crown-5822775.svg';
// import crownIconUrl from '../assets/icons/noun-crown-5822775.svg';

const outlineThickness = '3px';

const StyledPlayerAvatar = styled.div<{
  size: number;
  outline: boolean;
  url: string;
  isBanker: boolean;
}>`
  justify-self: center;

  position: relative;
  box-sizing: border-box;

  border: ${(props) => (props.outline ? outlineThickness : '0')} solid
    ${(props) => (props.isBanker ? '#DDB700' : 'white')};
  border-radius: calc(${(props) => props.size}px / 2);
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;

  background: url(${(props) => props.url});
  background-position: center;
  background-size: contain;
`;

// const FloatingCrown = styled(CrownIcon)<{ size: number }>`
//   width: 16px;
//   position: absolute;
//   top: -24px;
//   left: ${(props) => props.size / 2 - 10}px;
// `;

export interface PlayerAvatarProps {
  className?: string;
  player: Player | undefined;
  size: number;
  outline: boolean;
  crown: boolean;
}

export default function PlayerAvatar({
  className,
  player,
  size,
  outline,
  crown,
}: PlayerAvatarProps) {
  // Global state reducer
  const globalState = React.useContext(GlobalStateContext);

  const isBanker =
    !!globalState.lobby &&
    (player?.id.$oid ?? '') === globalState.lobby.banker.$oid;

  const avatarUrl = `https://avatar.home.spgill.me/6.x/adventurer-neutral/svg?flip=true&seed=${player?.id.$oid}`;

  return (
    <StyledPlayerAvatar
      className={className}
      size={size}
      url={avatarUrl}
      outline={outline}
      isBanker={crown && isBanker}
    >
      {/* "#FFD300" */}
      {/* {isBanker && <FloatingCrown size={size} fill="#DDB700" />} */}
      {/* {player && <Backdrop size={size} playerId={player._id.$oid} />} */}
    </StyledPlayerAvatar>
  );
}

const StyledEntityAvatar = styled.div<{ size: number }>`
  justify-self: center;

  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;

  box-sizing: border-box;

  border: ${outlineThickness} solid
    ${(props) =>
      polished.darken(0.25, props.theme.global.colors.monopolyPaleGreen)};
  border-radius: calc(${(props) => props.size}px / 2);
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;

  > svg {
    width: 61.8%;

    fill: ${(props) =>
      polished.darken(0.618, props.theme.global.colors.monopolyPaleGreen)};
  }
`;

export interface EntityAvatarProps {
  className?: string;
  size: number;
}

export function EntityAvatar({
  className,
  size,
  children,
}: PropsWithChildren<EntityAvatarProps>): JSX.Element {
  return (
    <StyledEntityAvatar className={className} size={size}>
      {children}
    </StyledEntityAvatar>
  );
}
