# stdlib imports
import datetime
import random
import typing

# vendor imports
import beanie
import fastapi
import starsessions

# local imports
from . import helpers, strings, model, socket


async def validateSession(
    request: fastapi.Request,
) -> tuple[
    typing.Optional[strings.Bundle],
    typing.Optional[model.db.Lobby],
    typing.Optional[model.db.Player],
]:
    now = datetime.datetime.now()
    await starsessions.load_session(request)

    # Fetch the lobby id from the session
    lobby_id = request.session.get("lobbyId", None)
    if not lobby_id:
        return (strings.Bundle.ERROR_SESSION_INVALID, None, None)

    lobby_document = await model.db.Lobby.get(lobby_id)

    # If the lobby no longer exists OR the lobby has expired OR the lobby has
    # been disbanded, then we return invalid lobby
    if (
        lobby_document is None
        or lobby_document.expires < now
        or lobby_document.disbanded
    ):
        return (strings.Bundle.ERROR_LOBBY_INVALID, None, None)

    # Fetch the player from the lobby document
    player = lobby_document.get_player(
        beanie.PydanticObjectId(request.session.get("playerId", None))
    )
    if player is None:
        return (strings.Bundle.ERROR_PLY_NOT_ACTIVE, None, None)

    return (None, lobby_document, player)


transferEntityStrings = {
    strings.TransferEntity.SELF: strings.Bundle.TRANSFER_SELF,
    strings.TransferEntity.BANK: strings.Bundle.TRANSFER_BANK,
    strings.TransferEntity.FP: strings.Bundle.TRANSFER_FP,
}


def decodeTransferEntity(key: str):
    try:
        return strings.TransferEntity(key)
    except ValueError:
        return key


def bundleInsert(member: strings.Bundle) -> model.db.EventInsertType:
    return ["bundle", member.name]


def playerInsert(
    player: model.db.Player,
) -> model.db.EventInsertType:
    return ["player", player.id]


def currencyInsert(amount: int) -> model.db.EventInsertType:
    return ["currency", amount]


def randomCode(n=4):
    return "".join(random.sample("0123456789", n))


# Create the router
apiRouter = fastapi.APIRouter()


@apiRouter.get("/api/preflight")
async def api_preflight(request: fastapi.Request):
    """
    API checked by clients on page load.

    Returns the player's current session as well as all string bundles.
    """

    # Create the basic data structure to return
    data = {
        "bundleMap": strings.bundleMap,
        "transferEntityMap": strings.transferEntityMap,
        "lobbyId": None,
        "playerId": None,
    }

    # Verify session info, and if there are errors, wipe the session
    (error, lobby, player) = await validateSession(request)
    if error:
        request.session.clear()
    else:
        data["lobbyId"] = request.session["lobbyId"]
        data["playerId"] = request.session["playerId"]

    # If it gets here, just return nothing
    return helpers.composeResponse(data)


@apiRouter.post("/api/create")
async def api_create(request: fastapi.Request, form: model.db.CreateLobbyForm):
    """
    API to create a new lobby.

    Returns the join code of the new lobby.
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    # Fetch a list of existing (valid) lobby codes, and generate a new one until
    # a unique one is found.
    living_lobbies = (
        await model.db.Lobby.find(
            model.db.Lobby.expires > now, model.db.Lobby.disbanded == False
        )
        .project(model.db.LobbyCodeProjection)
        .to_list()
    )
    existingCodes: set[str] = set(doc.code for doc in living_lobbies)

    lobbyCode: str = ""
    while True:
        lobbyCode = randomCode()
        if lobbyCode not in existingCodes:
            break

    # Now that we have a unique code, let's create a new lobby
    lobby = model.db.Lobby(
        code=lobbyCode,
        created=now,
        expires=now + datetime.timedelta(hours=24),
        disbanded=False,
        options=form,
        players=[],
        banker=None,
        bank=form.bankBalance,
        freeParking=0,
    )
    await lobby.insert()

    return helpers.composeResponse({"id": str(lobby.id), "code": lobby.code})


@apiRouter.post("/api/join")
async def api_join(request: fastapi.Request, form: model.db.JoinLobbyForm):
    """
    API for a user to join a lobby, by its code.
    """
    now = datetime.datetime.utcnow()

    # First things first, make sure the player name is not on the list
    if form.name.lower() in strings.playerNameBlacklist:
        return helpers.composeError(strings.Bundle.ERROR_PLY_NAME_BLACKLIST)

    # If a code was given,
    # check the code to make sure that the lobby actually exists
    lobby = await model.db.Lobby.find_one(
        model.db.Lobby.code == form.code.upper(),
        model.db.Lobby.expires > now,
        model.db.Lobby.disbanded == False,
    )
    if lobby is None:
        return helpers.composeError(strings.Bundle.ERROR_LOBBY_CODE_INVALID)

    # Type guard for the lobby ID
    assert lobby.id is not None

    # Double check there's enough room (maximum of 8 players)
    if len(lobby.players) >= lobby.options.maxPlayers:
        return helpers.composeError(strings.Bundle.ERROR_LOBBY_FULL)

    # It's been found (or made), so let's create the player document
    # and attach it to the lobby. Also, subtract the player's starting
    # balance from the bank.
    player = model.db.Player(
        name=form.name, balance=lobby.options.startingBalance
    )
    lobby.players.append(player)
    lobby.bank -= player.balance

    # Log an event announcing the player has joined the game
    join_event = model.db.Event(
        lobby=lobby.id,
        time=datetime.datetime.now(datetime.timezone.utc),
        key=strings.Bundle.EVENT_PLY_JOIN.name,
        inserts=[playerInsert(player), currencyInsert(player.balance)],
    )
    await join_event.insert()

    new_events: list[model.db.Event] = [join_event]

    # The first player to join the lobby gets made the banker
    if len(lobby.players) == 1:
        lobby.banker = player.id
        banker_event = model.db.Event(
            lobby=lobby.id,
            time=datetime.datetime.now(datetime.timezone.utc),
            key=strings.Bundle.EVENT_PLY_MADE_BANKER.name,
            inserts=[playerInsert(player)],
        )
        await banker_event.insert()
        new_events.append(banker_event)

    # Save changes to the lobby
    await lobby.save()

    # Broadcast the lobby updates and new events to all players
    await socket.manager.broadcast_update(lobby, new_events)

    # Store the lobby id and player id in the player's session
    await starsessions.load_session(request)
    request.session["lobbyId"] = str(lobby.id)
    request.session["playerId"] = str(player.id)

    return helpers.composeResponse(
        {"lobby": str(lobby.id), "player": str(player.id)}
    )


@apiRouter.post("/api/transfer")
async def api_transfer(
    request: fastapi.Request, form: model.forms.TransferForm
):
    """API method to transfer funds from one account to another."""
    # Verify that the lobby and player are valid. Return any errors
    (error, lobby, player) = await validateSession(request)
    if error:
        return helpers.composeError(error)
    if lobby is None or player is None:
        return helpers.composeError(strings.Bundle.ERROR_UNKNOWN)

    # Parse and extract the data sent by the client
    source = decodeTransferEntity(form.source)
    destination = decodeTransferEntity(form.destination)
    amount = form.amount

    # First, make sure that the player has permission
    # If the source is anything besides the current player, then the
    # current player must be the banker.
    if source is not strings.TransferEntity.SELF and player.id != lobby.banker:
        return helpers.composeError(strings.Bundle.ERROR_PLY_NOT_BANKER)

    # Next, make sure the debted party has enough funds
    sufficient = None
    if source is strings.TransferEntity.SELF:
        sufficient = player.balance >= amount
    elif source is strings.TransferEntity.BANK:
        if lobby.options.unlimitedBank:
            sufficient = True
        else:
            sufficient = lobby.bank >= amount
    elif source is strings.TransferEntity.FP:
        sufficient = lobby.freeParking >= amount
    else:
        return helpers.composeError(strings.Bundle.ERROR_TRANSFER_INVALID_SRC)

    if not sufficient:
        return helpers.composeError(strings.Bundle.ERROR_TRANSFER_FUNDS)

    # Now, deduct that amount from the debited party
    if source is strings.TransferEntity.SELF:
        player.balance -= amount
    elif source is strings.TransferEntity.BANK:
        lobby.bank -= amount
    elif source is strings.TransferEntity.FP:
        lobby.freeParking -= amount

    # Next, add the amount to the credited party
    destinationInsert: model.db.EventInsertType
    if isinstance(destination, strings.TransferEntity):
        destinationInsert = bundleInsert(transferEntityStrings[destination])
        if destination is strings.TransferEntity.SELF:
            player.balance += amount
        elif destination is strings.TransferEntity.BANK:
            lobby.bank += amount
        elif destination is strings.TransferEntity.FP:
            lobby.freeParking += amount
    else:
        destinationPlayer = lobby.get_player(
            beanie.PydanticObjectId(destination)
        )
        if destinationPlayer is None:
            return helpers.composeError(
                strings.Bundle.ERROR_TRANSFER_INVALID_DEST
            )
        destinationPlayer.balance += amount
        destinationInsert = playerInsert(destinationPlayer)

    sourceInsert = bundleInsert(transferEntityStrings[source])

    # Almost there, we just gotta log the transfer
    assert lobby.id
    event = model.db.Event(
        lobby=lobby.id,
        time=datetime.datetime.now(datetime.timezone.utc),
        key=strings.Bundle.EVENT_TRANSFER.name,
        inserts=[
            playerInsert(player),
            currencyInsert(amount),
            sourceInsert,
            destinationInsert,
        ],
    )
    await event.create()

    # Finally, save changes to the lobby document and broadcast the updates
    await lobby.save()
    await socket.manager.broadcast_update(lobby, [event])

    # If all is well, just return True
    return helpers.composeResponse(True)


@apiRouter.get("/api/leave")
async def api_leave(request: fastapi.Request):
    """
    API method for current player to leave lobby
    """
    # Verify that the lobby and player are valid. Return any errors
    (error, lobby, player) = await validateSession(request)
    if error:
        return helpers.composeError(error)
    elif lobby is None or player is None:
        return helpers.composeError(strings.Bundle.ERROR_UNKNOWN)

    # If the player is the banker, don't allow them to leave
    if player.id == lobby.banker:
        return helpers.composeError(strings.Bundle.ERROR_BANKER_CANNOT_LEAVE)

    # Transfer the player's balance back to the bank
    lobby.bank += player.balance

    # Remove the player from the lobby
    lobby.players.remove(player)

    # Log the event
    assert lobby.id
    event = model.db.Event(
        lobby=lobby.id,
        time=datetime.datetime.now(datetime.timezone.utc),
        key=strings.Bundle.EVENT_PLY_LEAVE.name,
        inserts=[],
    )
    await event.create()

    # Save changes to the lobby and broadcast them to the websockets
    await lobby.save()
    await socket.manager.broadcast_update(lobby, [event])

    # Finally, zero out the player's session
    request.session.clear()

    return helpers.composeResponse()


@apiRouter.get("/api/disband")
async def api_disband(request: fastapi.Request):
    """
    API method for the banker to disband the lobby
    """
    # Verify that the lobby and player are valid. Return any errors
    (error, lobby, player) = await validateSession(request)
    if error:
        return helpers.composeError(error)

    if lobby is None or player is None:
        return helpers.composeError(strings.Bundle.ERROR_UNKNOWN)

    # If the player is not the banker, return permission error
    if player.id != lobby.banker:
        return helpers.composeError(strings.Bundle.ERROR_PLY_NOT_BANKER)

    # Mark the lobby as disbanded
    lobby.disbanded = True
    await lobby.save()

    # Log the event and broadcast it
    assert lobby.id
    event = model.db.Event(
        lobby=lobby.id,
        time=datetime.datetime.utcnow(),
        key=strings.Bundle.EVENT_DISBANDED.name,
        inserts=[],
    )
    await event.insert()

    # Instead of broadcasting this event to players (what's the point?)
    # we just broadcast a message to kick them all from the game
    await socket.manager.broadcast_disband(lobby)

    # Return empty response
    return helpers.composeResponse()


################################################################################
# THE FOLLOWING TWO API ROUTES ARE NOT CURRENTLY UTILIZED IN THE UI
################################################################################


# @apiRouter.get("/api/promote/{target_id_str}")
# async def api_promote(request: fastapi.Request, target_id_str: str):
#     """
#     API method to transfer banker responsibilities from one player to another
#     """
#     # Verify that the lobby and player are valid. Return any errors
#     (error, lobby, player) = await validateSession(request)
#     if error:
#         return helpers.composeError(error)
#     elif lobby is None or player is None:
#         return helpers.composeError(strings.Bundle.ERROR_UNKNOWN)

#     # Make sure the current player is the banker
#     if player.id != lobby.banker:
#         return helpers.composeError(strings.Bundle.ERROR_PLY_NOT_BANKER)

#     target_id = model.db.ObjectId(target_id_str)
#     target = lobby.get_player(target_id)
#     if target is None:
#         return helpers.composeError(strings.Bundle.ERROR_PLY_NOT_FOUND)

#     # Log the transfer of power
#     event = model.db.Event(
#         lobby=lobby.id,
#         time=datetime.datetime.utcnow(),
#         key=strings.Bundle.EVENT_PLY_TRANSFER_BANKER.name,
#         inserts=[playerInsert(player), playerInsert(target)],
#     )
#     await event.insert()

#     # Update the banker in the lobby doc and broadcast the changes
#     lobby.banker = target_id
#     await lobby.update()
#     await socket.manager.broadcast_update(lobby, [event])

#     return helpers.composeResponse()


# @apiRouter.get("/api/kick/{target_id_str}")
# async def api_kick(request: fastapi.Request, target_id_str: str):
#     """
#     API method for current player to leave lobby
#     """
#     # Verify that the lobby and player are valid. Return any errors
#     (error, lobby, player) = await validateSession(request)
#     if error:
#         return helpers.composeError(error)
#     elif lobby is None or player is None:
#         return helpers.composeError(strings.Bundle.ERROR_UNKNOWN)

#     # Make sure the current player is the banker
#     if player.id != lobby.banker:
#         return helpers.composeError(strings.Bundle.ERROR_PLY_NOT_BANKER)

#     # Parse the request data and find the target player
#     target_id = model.db.ObjectId(target_id_str)
#     target = lobby.get_player(target_id)
#     if target is None:
#         return helpers.composeError(strings.Bundle.ERROR_PLY_NOT_FOUND)

#     # Make sure the target isn't themselves
#     if target.id == player.id:
#         return helpers.composeError(strings.Bundle.ERROR_KICK_YOURSELF)

#     # Transfer the target's balance back to the bank
#     lobby.bank += target.balance

#     # Remove the target player from the lobby
#     lobby.players.remove(target)

#     # Log the event
#     event = model.db.Event(
#         lobby=lobby.id,
#         time=datetime.datetime.utcnow(),
#         key=strings.Bundle.EVENT_PLY_KICK.name,
#         inserts=[],
#     )
#     await event.insert()

#     # Update the lobby document and broadcast the changes
#     await lobby.update()
#     await socket.manager.broadcast_update(lobby, [event])

#     # Broadcast the message to kick the player from the lobby
#     await socket.manager.broadcast_kick(lobby, player)

#     return helpers.composeResponse()
