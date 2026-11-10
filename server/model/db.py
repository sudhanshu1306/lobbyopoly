# stdlib imports
import datetime
import enum
import os
import typing

# vendor imports
import beanie
import motor.motor_asyncio
import pydantic

# local imports


db_client: typing.Optional[motor.motor_asyncio.AsyncIOMotorClient] = None


async def connect_and_init_db():
    print("Connecting to MongoDB...")
    mongodbUrl = os.environ.get("MONGODB_HOST", None)
    global db_client
    db_client = motor.motor_asyncio.AsyncIOMotorClient(mongodbUrl)
    await beanie.init_beanie(
        database=db_client.get_default_database(),
        document_models=[Lobby, Event],
    )


async def close_db_connect():
    print("Disconnecting from MongoDB...")
    global db_client
    if db_client is None:
        return
    db_client.close()
    db_client = None


class FormBaseModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(use_enum_values=True)


class LobbyCurrency(enum.Enum):
    Dollars = "$"
    Pounds = "£"


class CreateLobbyForm(FormBaseModel):
    unlimitedBank: bool
    freeParking: bool
    hideBalances: bool = False
    maxPlayers: int
    bankBalance: int
    startingBalance: int
    currency: LobbyCurrency


class JoinLobbyForm(pydantic.BaseModel):
    code: str
    name: str


class Player(pydantic.BaseModel):
    id: beanie.PydanticObjectId = pydantic.Field(
        default_factory=beanie.PydanticObjectId
    )

    name: str
    balance: int


class Lobby(beanie.Document):
    # Lobby session information
    code: str
    created: datetime.datetime
    expires: datetime.datetime
    disbanded: bool
    options: CreateLobbyForm  # for now these are equivalent, but this may change in the future

    # Balances in the lobby
    bank: int
    freeParking: int

    # Id of the banker player
    banker: typing.Optional[beanie.PydanticObjectId]

    # List of players in the lobby
    players: list[Player]

    class Settings:
        name = "lobbies"

    def get_player(self, oid: beanie.PydanticObjectId | None) -> Player | None:
        for ply in self.players:
            if ply.id == oid:
                return ply
        return None


class LobbyCodeProjection(pydantic.BaseModel):
    code: str


EventInsertType = list[typing.Union[beanie.PydanticObjectId, int, str]]


class Event(beanie.Document):
    lobby: beanie.PydanticObjectId
    time: datetime.datetime
    key: str
    inserts: list[EventInsertType]

    class Settings:
        name = "events"
