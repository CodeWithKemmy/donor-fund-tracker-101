import { verify } from "@dfinity/agent";
import { auto } from "@popperjs/core";
import {
  query,
  update,
  text,
  Null,
  Record,
  StableBTreeMap,
  Variant,
  Vec,
  None,
  Some,
  Ok,
  Err,
  ic,
  Principal,
  Opt,
  nat64,
  Duration,
  Result,
  bool,
  Canister,
} from "azle";
import {
  Address,
  Ledger,
  binaryAddressFromAddress,
  binaryAddressFromPrincipal,
  hexAddressFromPrincipal,
} from "azle/canisters/ledger";
import { hashCode } from "hashcode";
import { v4 as uuidv4 } from "uuid";

// Donor Profile Struct
const DonorProfile = Record({
  id: text,
  owner: Principal,
  name: text,
  phoneNumber: text,
  email: text,
  address: text,
  donationAmount: nat64,
  donations: Vec(text),
  donationsCount: nat64,
  status: text,
  joinedAt: text,
});

// Donor Status Enum
const DonorStatus = Variant({
  Active: text,
  Inactive: text,
  Suspended: text,
});

// Charity Profile Struct
const Charity = Record({
  id: text,
  owner: Principal,
  name: text,
  phoneNumber: text,
  email: text,
  address: text,
  missionStatement: text,
  totalReceived: nat64,
  donationsReceived: Vec(text),
  donationsCount: nat64,
  status: text,
  registeredAt: text,
});

// Campaign Status Enum
const CampaignStatus = Variant({
  Active: text,
  Accepted: text,
  Completed: text,
  Cancelled: text,
  Pending: text,
});

// Campaign Struct
const Campaign = Record({
  id: text,
  charityId: text,
  title: text,
  description: text,
  targetAmount: nat64,
  totalReceived: nat64,
  donors: Vec(text),
  status: CampaignStatus,
  creator: Principal,
  startedAt: text,
});

// Donation Status Enum
const DonationStatus = Variant({
  PaymentPending: text,
  Completed: text,
  Cancelled: text,
});

// Donation Reserve Struct
const Donation = Record({
  id: text,
  donorId: text,
  charityId: text,
  campaignId: text,
  donator: Principal,
  receiver: Principal,
  amount: nat64,
  status: DonationStatus,
  createdAt: text,
  paid_at_block: Opt(nat64),
  memo: nat64,
});

// Donationation Report enum
const DonationReportStatus = Variant({
  Pending: text,
  Completed: text,
  Cancelled: text,
});

// Donation Report Struct
const DonationReport = Record({
  id: text,
  donorId: text,
  charityId: text,
  campaignId: text,
  campaignTitle: text,
  amount: nat64,
  status: DonationReportStatus,
  createdAt: text,
  paidAt: Opt(text),
});

// Message Struct
const Message = Variant({
  Success: text,
  Error: text,
  NotFound: text,
  InvalidPayload: text,
  PaymentFailed: text,
  PaymentCompleted: text,
});

// Payloads

// Donor Profile Payload
const DonorProfilePayload = Record({
  name: text,
  phoneNumber: text,
  email: text,
  address: text,
});

// Charity Profile Payload
const CharityProfilePayload = Record({
  name: text,
  phoneNumber: text,
  email: text,
  address: text,
  missionStatement: text,
});

// Campaign Payload
const CampaignPayload = Record({
  charityId: text,
  title: text,
  description: text,
  targetAmount: nat64,
});

// Donation Payload
const DonationPayload = Record({
  donorId: text,
  charityId: text,
  campaignId: text,
  amount: nat64,
});

// Donation Report Payload
const DonationReportPayload = Record({
  donorId: text,
  charityId: text,
  campaignId: text,
  campaignTitle: text,
  amount: nat64,
});

// Storage
const donorProfileStorage = StableBTreeMap(0, text, DonorProfile);
const charityProfileStorage = StableBTreeMap(1, text, Charity);
const campaignStorage = StableBTreeMap(2, text, Campaign);
const persistedReserves = StableBTreeMap(3, Principal, Donation);
const pendingReserves = StableBTreeMap(4, nat64, Donation);
const donationReportStorage = StableBTreeMap(5, text, DonationReport);

const TIMEOUT_PERIOD = 9600n; // reservation period in seconds

/* 
    initialization of the Ledger canister. The principal text value is hardcoded because 
    we set it in the `dfx.json`
*/
const icpCanister = Ledger(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"));

// Functions

export default Canister({
  // Create a Donor Profile with validation
  createDonorProfile: update(
    [DonorProfilePayload],
    Result(DonorProfile, Message),
    (payload) => {
      // Validate the payload
      if (
        !payload.name ||
        !payload.email ||
        !payload.phoneNumber ||
        !payload.address
      ) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      // Check for valid email format (simple regex example)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        return Err({ InvalidPayload: "Invalid email format" });
      }

      // Validation for unique email check
      const donorProfiles = donorProfileStorage.values();
      const emailExists = donorProfiles.some(
        (profile) => profile.email === payload.email
      );
      if (emailExists) {
        return Err({ InvalidPayload: "Email already exists" });
      }

      // Assuming validation passes, proceed to create the donor profile
      const donorId = uuidv4();
      const donor = {
        ...payload,
        id: donorId,
        owner: ic.caller(),
        donationAmount: 0n,
        donations: [],
        donationsCount: 0n,
        status: "Active",
        joinedAt: new Date().toISOString(),
      };
      donorProfileStorage.insert(donorId, donor);
      return Ok(donor); // Successfully return the created donor profile
    }
  ),

  // Function to update a Donor Profile
  updateDonorProfile: update(
    [text, DonorProfilePayload],
    Result(DonorProfile, Message),
    (donorId, payload) => {
      const donorProfileOpt = donorProfileStorage.get(donorId);

      if ("None" in donorProfileOpt) {
        return Err({
          NotFound: `Donor profile with id=${donorId} not found`,
        });
      }

      const donorProfile = donorProfileOpt.Some;

      // Check if the caller is the owner of the donor profile
      if (donorProfile.owner !== ic.caller()) {
        return Err({ Error: "Unauthorized" });
      }

      // Update the donor profile
      const updatedDonorProfile = {
        ...donorProfile,
        ...payload,
      };
      donorProfileStorage.insert(donorId, updatedDonorProfile);

      return Ok(updatedDonorProfile);
    }
  ),

  // Function to get a Donor Profile by ID
  getDonorProfileById: query(
    [text],
    Result(DonorProfile, Message),
    (donorId) => {
      const donorProfileOpt = donorProfileStorage.get(donorId);

      if ("None" in donorProfileOpt) {
        return Err({
          NotFound: `Donor profile with id=${donorId} not found`,
        });
      }

      return Ok(donorProfileOpt.Some);
    }
  ),

  // Function to get a Donor Profile by Owner Principal using filter
  getDonorProfileByOwner: query([], Result(DonorProfile, Message), () => {
    const donorProfiles = donorProfileStorage.values().filter((donor) => {
      return donor.owner.toText === ic.caller().toText;
    });

    if (donorProfiles.length === 0) {
      return Err({
        NotFound: `Donor profile for owner=${ic.caller()} not found`,
      });
    }

    return Ok(donorProfiles[0]);
  }),

  // Function to get all Donor Profiles with error handling
  getAllDonorProfiles: query([], Result(Vec(DonorProfile), Message), () => {
    const donorProfiles = donorProfileStorage.values();

    // Check if there are any donor profiles
    if (donorProfiles.length === 0) {
      return Err({ NotFound: "No donor profiles found" });
    }

    return Ok(donorProfiles);
  }),

  // Funtion to delete a Donor Profile
  deleteDonorProfile: update([text], Result(Null, Message), (donorId) => {
    const donorProfileOpt = donorProfileStorage.get(donorId);

    if ("None" in donorProfileOpt) {
      return Err({
        NotFound: `Donor profile with id=${donorId} not found`,
      });
    }

    const donorProfile = donorProfileOpt.Some;

    // Check if the caller is the owner of the donor profile
    if (donorProfile.owner !== ic.caller()) {
      return Err({ Error: "Unauthorized" });
    }

    donorProfileStorage.remove(donorId);

    return Ok(null);
  }),

  // Create a Charity Profile with validation
  createCharityProfile: update(
    [CharityProfilePayload],
    Result(Charity, Message),
    (payload) => {
      // Validate the payload
      if (
        !payload.name ||
        !payload.email ||
        !payload.phoneNumber ||
        !payload.address ||
        !payload.missionStatement
      ) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      // Check for valid email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        return Err({ InvalidPayload: "Invalid email format" });
      }

      // Validation for unique email check
      const charityProfiles = charityProfileStorage.values();
      const emailExists = charityProfiles.some(
        (profile) => profile.email === payload.email
      );
      if (emailExists) {
        return Err({ InvalidPayload: "Email already exists" });
      }

      // Assuming validation passes, proceed to create the charity profile
      const charityId = uuidv4();
      const charity = {
        id: charityId,
        owner: ic.caller(),
        name: payload.name,
        phoneNumber: payload.phoneNumber,
        email: payload.email,
        address: payload.address,
        missionStatement: payload.missionStatement,
        totalReceived: 0n,
        donationsReceived: [],
        donationsCount: 0n,
        status: "Active",
        registeredAt: new Date().toISOString(),
      };
      charityProfileStorage.insert(charityId, charity);
      return Ok(charity); // Successfully return the created charity profile
    }
  ),

  // Function to update a Charity Profile
  updateCharityProfile: update(
    [text, CharityProfilePayload],
    Result(Charity, Message),
    (charityId, payload) => {
      const charityProfileOpt = charityProfileStorage.get(charityId);

      if ("None" in charityProfileOpt) {
        return Err({
          NotFound: `Charity profile with id=${charityId} not found`,
        });
      }

      const charityProfile = charityProfileOpt.Some;

      // Check if the caller is the owner of the charity profile
      if (charityProfile.owner !== ic.caller()) {
        return Err({ Error: "Unauthorized" });
      }

      // Update the charity profile
      const updatedCharityProfile = {
        ...charityProfile,
        ...payload,
      };
      charityProfileStorage.insert(charityId, updatedCharityProfile);

      return Ok(updatedCharityProfile);
    }
  ),

  // Function to get a Charity Profile by ID
  getCharityProfileById: query(
    [text],
    Result(Charity, Message),
    (charityId) => {
      const charityProfileOpt = charityProfileStorage.get(charityId);

      if ("None" in charityProfileOpt) {
        return Err({
          NotFound: `Charity profile with id=${charityId} not found`,
        });
      }

      return Ok(charityProfileOpt.Some);
    }
  ),

  // Function to get a Charity Profile by Owner Principal using filter
  getCharityProfileByOwner: query([], Result(Charity, Message), () => {
    const charityProfiles = charityProfileStorage.values().filter((charity) => {
      return charity.owner.toText === ic.caller().toText;
    });

    if (charityProfiles.length === 0) {
      return Err({
        NotFound: `Charity profile for owner=${ic.caller()} not found`,
      });
    }

    return Ok(charityProfiles[0]);
  }),

  // Function to get all Charity Profiles with error handling
  getAllCharityProfiles: query([], Result(Vec(Charity), Message), () => {
    const charityProfiles = charityProfileStorage.values();

    // Check if there are any charity profiles
    if (charityProfiles.length === 0) {
      return Err({ NotFound: "No charity profiles found" });
    }

    return Ok(charityProfiles);
  }),

  // Funtion to delete a Charity Profile
  deleteCharityProfile: update([text], Result(Null, Message), (charityId) => {
    const charityProfileOpt = charityProfileStorage.get(charityId);

    if ("None" in charityProfileOpt) {
      return Err({
        NotFound: `Charity profile with id=${charityId} not found`,
      });
    }

    const charityProfile = charityProfileOpt.Some;

    // Check if the caller is the owner of the charity profile
    if (charityProfile.owner !== ic.caller()) {
      return Err({ Error: "Unauthorized" });
    }

    charityProfileStorage.remove(charityId);

    return Ok(null);
  }),

  // Campaign Functions
  // Create a Campaign with validation
  createCampaign: update(
    [CampaignPayload],
    Result(Campaign, Message),
    (payload) => {
      // Validate the payload
      if (!payload.title || !payload.description || !payload.targetAmount) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      // Check if the charity exists
      const charityProfileOpt = charityProfileStorage.get(payload.charityId);
      if ("None" in charityProfileOpt) {
        return Err({
          NotFound: `Charity with id=${payload.charityId} not found`,
        });
      }

      // Assuming validation passes, proceed to create the campaign
      const campaignId = uuidv4();
      const campaign = {
        ...payload,
        id: campaignId,
        totalReceived: 0n,
        donors: [],
        status: { Pending: "Pending" },
        creator: ic.caller(),
        startedAt: new Date().toISOString(),
      };

      campaignStorage.insert(campaignId, campaign);
      return Ok(campaign); // Successfully return the created campaign
    }
  ),

  // Function to update a Campaign
  updateCampaign: update(
    [text, CampaignPayload],
    Result(Campaign, Message),
    (campaignId, payload) => {
      const campaignOpt = campaignStorage.get(campaignId);

      if ("None" in campaignOpt) {
        return Err({
          NotFound: `Campaign with id=${campaignId} not found`,
        });
      }

      const campaign = campaignOpt.Some;

      // Check if the caller is the creator of the campaign
      if (campaign.creator !== ic.caller()) {
        return Err({ Error: "Unauthorized" });
      }

      // Update the campaign
      const updatedCampaign = {
        ...campaign,
        ...payload,
      };
      campaignStorage.insert(campaignId, updatedCampaign);

      return Ok(updatedCampaign);
    }
  ),

  // Function to get a Campaign by ID
  getCampaignById: query([text], Result(Campaign, Message), (campaignId) => {
    const campaignOpt = campaignStorage.get(campaignId);

    if ("None" in campaignOpt) {
      return Err({
        NotFound: `Campaign with id=${campaignId} not found`,
      });
    }

    return Ok(campaignOpt.Some);
  }),

  // Function to get all Campaigns with error handling
  getAllCampaigns: query([], Result(Vec(Campaign), Message), () => {
    const campaigns = campaignStorage.values();

    // Check if there are any campaigns
    if (campaigns.length === 0) {
      return Err({ NotFound: "No campaigns found" });
    }

    return Ok(campaigns);
  }),

  // Function to delete a Campaign
  deleteCampaignById: update([text], Result(Null, Message), (campaignId) => {
    const campaignOpt = campaignStorage.get(campaignId);

    if ("None" in campaignOpt) {
      return Err({
        NotFound: `Campaign with id=${campaignId} not found`,
      });
    }

    const campaign = campaignOpt.Some;

    // Check if the caller is the creator of the campaign
    if (campaign.creator !== ic.caller()) {
      return Err({ Error: "Unauthorized" });
    }

    campaignStorage.remove(campaignId);

    return Ok(null);
  }),

  // Function to get all accepted campaigns
  getAcceptedCampaigns: query([], Result(Vec(Campaign), Message), () => {
    const campaigns = campaignStorage.values().filter((campaign) => {
      return (
        "Accepted" in campaign.status && campaign.status.Accepted === "Accepted"
      );
    });

    // Check if there are any campaigns
    if (campaigns.length === 0) {
      return Err({ NotFound: "No accepted campaigns found" });
    }

    return Ok(campaigns);
  }),

  // Function to mark a campaign as completed, performed by the charity organization
  completeCampaign: update([text], Result(Campaign, Message), (campaignId) => {
    const campaignOpt = campaignStorage.get(campaignId);

    if ("None" in campaignOpt) {
      return Err({
        NotFound: `Campaign with id=${campaignId} not found`,
      });
    }

    const campaign = campaignOpt.Some;

    // Update the campaign status
    const updatedCampaign = {
      ...campaign,
      status: { Completed: "Completed" },
    };
    campaignStorage.insert(campaignId, updatedCampaign);

    return Ok(updatedCampaign);
  }),

  // Function to fetch completed campaigns
  getCompletedCampaigns: query([], Result(Vec(Campaign), Message), () => {
    const campaigns = campaignStorage.values().filter((campaign) => {
      return campaign.status.Completed === "Completed";
    });

    // Check if there are any campaigns
    if (campaigns.length === 0) {
      return Err({ NotFound: "No completed campaigns found" });
    }

    return Ok(campaigns);
  }),

  // Get campaigns accepted by the donor
  getDonorCampaigns: query(
    [text],
    Result(Vec(Campaign), Message),
    (donorId) => {
      const donorProfileOpt = donorProfileStorage.get(donorId);
      if ("None" in donorProfileOpt) {
        return Err({
          NotFound: `Donor with id=${donorId} not found`,
        });
      }

      const donor = donorProfileOpt.Some;
      const campaigns = campaignStorage.values().filter((campaign) => {
        return campaign.donors.includes(donorId);
      });

      // Check if there are any campaigns
      if (campaigns.length === 0) {
        return Err({ NotFound: "No campaigns found for this donor" });
      }

      return Ok(campaigns);
    }
  ),

  // Function for a donor to accept a campaign
  acceptCampaign: update(
    [text, text],
    Result(Campaign, Message),
    (donorId, campaignId) => {
      // Check if the donor exists
      const donorProfileOpt = donorProfileStorage.get(donorId);
      if ("None" in donorProfileOpt) {
        return Err({
          NotFound: `Donor with id=${donorId} not found`,
        });
      }

      // Check if the campaign exists
      const campaignOpt = campaignStorage.get(campaignId);
      if ("None" in campaignOpt) {
        return Err({
          NotFound: `Campaign with id=${campaignId} not found`,
        });
      }

      // Assuming validation passes, proceed to accept the campaign
      const campaign = campaignOpt.Some;
      const donor = donorProfileOpt.Some;

      // Update the donor profile
      const updatedDonor = {
        ...donor,
        donations: [...donor.donations, campaignId],
        donationsCount: donor.donationsCount + 1n,
      };
      donorProfileStorage.insert(donorId, updatedDonor);

      // Update the campaign and the status to Accepted
      const updatedCampaign = {
        ...campaign,
        donors: [...campaign.donors, donorId],
        status: { Accepted: "Accepted" },
      };
      campaignStorage.insert(campaignId, updatedCampaign);

      return Ok(updatedCampaign); // Successfully return the updated campaign
    }
  ),

  // Donation Functions
  // Function to reserve a Donation with validation
  reserveDonation: update(
    [DonationPayload],
    Result(Donation, Message),
    (payload) => {
      // Validate the payload
      if (!payload.donorId || !payload.charityId || !payload.campaignId) {
        return Err({
          InvalidPayload: "Ensure all required fields are provided",
        });
      }

      // Check if the donor exists
      const donorProfileOpt = donorProfileStorage.get(payload.donorId);
      if ("None" in donorProfileOpt) {
        return Err({
          NotFound: `Cannot reserve donation: Donor with id=${payload.donorId} not found`,
        });
      }
      const donor = donorProfileOpt.Some;

      // Check if the charity exists
      const charityProfileOpt = charityProfileStorage.get(payload.charityId);
      if ("None" in charityProfileOpt) {
        return Err({
          NotFound: `Cannot reserve donation: Charity with id=${payload.charityId} not found`,
        });
      }
      const charity = charityProfileOpt.Some;

      // Check if the campaign exists
      const campaignOpt = campaignStorage.get(payload.campaignId);
      if ("None" in campaignOpt) {
        return Err({
          NotFound: `Cannot reserve donation: Campaign with id=${payload.campaignId} not found`,
        });
      }
      const campaign = campaignOpt.Some;

      try {
        // Assuming validation passes, proceed to reserve the donation
        const donationId = uuidv4();
        const donation = {
          id: donationId,
          donorId: payload.donorId,
          charityId: payload.charityId,
          campaignId: payload.campaignId,
          donator: donor.owner,
          receiver: campaign.creator,
          amount: payload.amount,
          status: { PaymentPending: "PaymentPending" },
          createdAt: new Date().toISOString(),
          paid_at_block: None,
          memo: generateCorrelationId(payload.donorId), // Ensure memo is handled as nat64
        };

        // Log the donation details for debugging
        console.log("Donation reserved:", donation);

        // Insert the reserve into the pending reserves storage
        pendingReserves.insert(donation.memo, donation);

        // Set a timeout to discard the reserve if not completed in time
        discardByTimeout(donation.memo, TIMEOUT_PERIOD);

        return Ok(donation); // Successfully return the reserved donation
      } catch (error) {
        return Err({
          Error: `An error occurred while creating the reserve: ${error}`,
        });
      }
    }
  ),

  // Complete a reserve for a donation
  completeReserveDonation: update(
    [Principal, text, nat64, nat64, nat64],
    Result(Donation, Message),
    async (reservor, donorId, reservePrice, block, memo) => {
      const paymentVerified = await verifyPaymentInternal(
        reservor,
        reservePrice,
        block,
        memo
      );
      if (!paymentVerified) {
        return Err({
          NotFound: `Cannot complete the donation reserve: cannot verify the payment, memo=${memo}`,
        });
      }
      const pendingReserveOpt = pendingReserves.remove(memo);
      if ("None" in pendingReserveOpt) {
        return Err({
          NotFound: `Cannot complete the donation reserve: there is no pending reserve with id=${donorId}`,
        });
      }
      const reserve = pendingReserveOpt.Some;
      const updatedReserve = {
        ...reserve,
        status: { Completed: "COMPLETED" },
        paid_at_block: Some(block),
      };

      const donorProfileOpt = donorProfileStorage.get(donorId);
      if ("None" in donorProfileOpt) {
        throw Error(`Donor with id=${donorId} not found`);
      }
      const donor = donorProfileOpt.Some;
      donor.donationAmount += reservePrice;
      donorProfileStorage.insert(donor.id, donor);
      persistedReserves.insert(ic.caller(), updatedReserve);
      return Ok(updatedReserve);
    }
  ),

  /*
        another example of a canister-to-canister communication
        here we call the `query_blocks` function on the ledger canister
        to get a single block with the given number `start`.
        The `length` parameter is set to 1 to limit the return amount of blocks.
        In this function we verify all the details about the transaction to make sure that we can mark the order as completed
    */
  verifyPayment: query(
    [Principal, nat64, nat64, nat64],
    bool,
    async (receiver, amount, block, memo) => {
      return await verifyPaymentInternal(receiver, amount, block, memo);
    }
  ),

  /*
              a helper function to get address from the principal
              the address is later used in the transfer method
          */
  getAddressFromPrincipal: query([Principal], text, (principal) => {
    return hexAddressFromPrincipal(principal, 0);
  }),

  // Function to get all Donations with error handling
  getAllDonations: query([], Result(Vec(Donation), Message), () => {
    const donations = persistedReserves.values();

    // Check if there are any donations
    if (donations.length === 0) {
      return Err({ NotFound: "No donations found" });
    }

    return Ok(donations);
  }),

  // Function to get all Donations for a Donor with error handling
  getDonorDonations: query(
    [text],
    Result(Vec(Donation), Message),
    (donorId) => {
      const donations = persistedReserves.values().filter((donation) => {
        return donation.donorId === donorId;
      });

      // Check if there are any donations
      if (donations.length === 0) {
        return Err({ NotFound: "No donations found for this donor" });
      }

      return Ok(donations);
    }
  ),

  // Function to get all Donations for a Charity with error handling
  getCharityDonations: query(
    [text],
    Result(Vec(Donation), Message),
    (charityId) => {
      const donations = persistedReserves.values().filter((donation) => {
        return donation.charityId === charityId;
      });

      // Check if there are any donations
      if (donations.length === 0) {
        return Err({ NotFound: "No donations found for this charity" });
      }

      return Ok(donations);
    }
  ),

  // Donation Report Functions
  // Function to create a Donation Report with validation
  createDonationReport: update(
    [DonationReportPayload],
    Result(DonationReport, Message),
    (payload) => {
      // Validate the payload
      if (
        !payload.donorId ||
        !payload.charityId ||
        !payload.campaignId ||
        !payload.campaignTitle ||
        !payload.amount
      ) {
        return Err({ InvalidPayload: "Missing required fields" });
      }

      // Check if the donor exists
      const donorProfileOpt = donorProfileStorage.get(payload.donorId);
      if ("None" in donorProfileOpt) {
        return Err({
          NotFound: `Cannot create donation report: Donor with id=${payload.donorId} not found`,
        });
      }

      // Check if the charity exists
      const charityProfileOpt = charityProfileStorage.get(payload.charityId);
      if ("None" in charityProfileOpt) {
        return Err({
          NotFound: `Cannot create donation report: Charity with id=${payload.charityId} not found`,
        });
      }

      // Check if the campaign exists
      const campaignOpt = campaignStorage.get(payload.campaignId);
      if ("None" in campaignOpt) {
        return Err({
          NotFound: `Cannot create donation report: Campaign with id=${payload.campaignId} not found`,
        });
      }

      // Assuming validation passes, proceed to create the donation report
      const donationReportId = uuidv4();
      const donationReport = {
        ...payload,
        id: donationReportId,
        status: { Completed: "Completed" },
        createdAt: new Date().toISOString(),
        paidAt: None,
      };

      donationReportStorage.insert(donationReportId, donationReport);
      return Ok(donationReport); // Successfully return the created donation report
    }
  ),
 
  // Function to get all Donation Reports with error handling
  getAllDonationReports: query([], Result(Vec(DonationReport), Message), () => {
    const donationReports = donationReportStorage.values();

    // Check if there are any donation reports
    if (donationReports.length === 0) {
      return Err({ NotFound: "No donation reports found" });
    }

    return Ok(donationReports);
  }),
});

/*
    a hash function that is used to generate correlation ids for orders.
    also, we use that in the verifyPayment function where we check if the used has actually paid the order
*/
function hash(input: any): nat64 {
  return BigInt(Math.abs(hashCode().value(input)));
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};

// HELPER FUNCTIONS
function generateCorrelationId(bookId: text): nat64 {
  const correlationId = `${bookId}_${ic.caller().toText()}_${ic.time()}`;
  return hash(correlationId);
}

/*
    after the order is created, we give the `delay` amount of minutes to pay for the order.
    if it's not paid during this timeframe, the order is automatically removed from the pending orders.
*/
function discardByTimeout(memo: nat64, delay: Duration) {
  ic.setTimer(delay, () => {
    const order = pendingReserves.remove(memo);
    console.log(`Reserve discarded ${order}`);
  });
}

async function verifyPaymentInternal(
  receiver: Principal,
  amount: nat64,
  block: nat64,
  memo: nat64
): Promise<bool> {
  const blockData = await ic.call(icpCanister.query_blocks, {
    args: [{ start: block, length: 1n }],
  });
  const tx = blockData.blocks.find((block) => {
    if ("None" in block.transaction.operation) {
      return false;
    }
    const operation = block.transaction.operation.Some;
    const senderAddress = binaryAddressFromPrincipal(ic.caller(), 0);
    const receiverAddress = binaryAddressFromPrincipal(receiver, 0);
    return (
      block.transaction.memo === memo &&
      hash(senderAddress) === hash(operation.Transfer?.from) &&
      hash(receiverAddress) === hash(operation.Transfer?.to) &&
      amount === operation.Transfer?.amount.e8s
    );
  });
  return tx ? true : false;
}
