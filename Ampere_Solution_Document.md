# Ampere Product Solution Document

## Purpose and product decision

Ampere will bring public EV charger discovery and private charger sharing into one web application for India. A driver will search once, understand which chargers fit the car, compare access and price, and either request a confirmed private slot or continue through the supported public-network flow. Residential owners, cafés and offices will be able to offer eligible chargers through a managed host journey.

The first release is a 24-hour hackathon MVP for a team of four or more developers, followed by a controlled Pune pilot. Cars are the first supported vehicle category. Scooters and other vehicles will need a separate compatibility and equipment review. This document defines the product, operating model, commercial assumptions, hurdles and launch decisions. The companion AI Implementation Specification defines the build contracts.

Version 1.1 · 21 October 2026 · Product name is a working name, with brand clearance pending.

## Assigned twist and revision scope

The organiser's assigned twist is mandatory for the final demonstration. Ampere remains a community EV charging network. Driver results must contain only chargers within the car's estimated reachable range and supporting its connector. The host still confirms before departure. Each booking is stored as an append-only event stream in the existing database, and its current state is derived by replay. The only booking lifecycle labels displayed are requested, host confirmed, on the way, charging and done.

A functional plain-text Jury Console accepts TICKET and READY commands, writes through the same booking services as the normal application, and demonstrates restoration after refresh. The detailed console and evaluation requirements are in section 21. This revision changes the necessary booking, discovery and live-update rules; the remaining product, pricing and pilot plan is retained. This is a documentation update, not an implemented feature.

## 1 What the two reference products contribute

ChargeIndia advertises public-network charger discovery, availability, UPI payments and session tracking. Its business offering describes an OCPI interoperability hub. This supplies the public-network side of Ampere's product concept. These are vendor descriptions, not independently verified service outcomes. [S1, S2]

PeerChargeEV describes a marketplace where drivers find and book shared chargers and hosts control prices and schedules. This supplies the community-host side. Its current homepage did not expose readable body text to the research tool; the description was available in its search-indexed page, crawled approximately two months before this document. [S3]

The combined product is our proposed design. There is no assumed partnership, right to reuse their listings, or access to their customers, software or payments. Ampere must obtain licensed data or operator agreements rather than use website scraping as a production data feed.

### One discovery experience with distinct fulfilment paths

- Public directory listing: show permitted location and connector information, its source and freshness, and an operator link. Availability may be unknown. Ampere cannot reserve or collect charging payments for it.
- Connected public network: enable status, payment, reservation or remote charging only when the specific integration and operator support each action.
- Community charger: Ampere manages host verification, availability, slot requests, host acceptance, arrival, session evidence and settlement.
- Demonstration listing: synthetic public and private examples carry a visible Demo label and cannot transact with real hosts or banks.

ChargeIndia's integration guide explicitly requires a commercial agreement, assigned credentials and coordinated integration testing. A published API guide does not give Ampere access. Public roaming is therefore a later integration milestone, not a hackathon dependency. [S4]

## 2 Problem and intended users

EV drivers face several decisions beyond finding a pin on a map: whether the connector fits, whether the equipment is working, whether the property allows entry, whether a slot is available, and what the complete session will cost. A private charger may be nearby but behind a locked gate or too slow for the driver's schedule. A public charger may have a useful location listing without a reliable live status feed.

Hosts face a different problem. Sharing equipment introduces access coordination, parking conflicts, electrical capacity constraints, wear, strangers at a property, and payment disputes. They need control over who books, when the charger is offered, and the evidence used to calculate earnings.

The initial users are car owners needing destination or backup charging, residential owners with permitted accessible parking, and cafés or offices with appropriate chargers and spare visitor capacity. We should recruit locally so that drivers have several plausible alternatives rather than one isolated listing.

### Product promise

Help drivers find a suitable charging option, understand the reliability of the information, and obtain access confirmation where Ampere can provide it. Help hosts share charging on their own schedule with visible records and transparent deductions.

Ampere must not promise guaranteed rescue at 4% battery. User-entered battery data, traffic, terrain, battery health and host response create uncertainty. The normal use case includes planned destination charging; the low-battery scenario demonstrates careful filtering and a fallback when no credible option exists.

## 3 Outcomes and differentiation

For drivers, the intended benefit is fewer disconnected searches and fewer avoidable trips to unsuitable chargers. For hosts, it is potential supplementary income with control over access. For communities, it is more accessible charging using equipment already installed. These are expected benefits to measure, not demonstrated impact statistics.

The differentiating hypothesis is the combination of compatibility checks, conservative journey estimates, clear information freshness, access instructions and confirmation. The reference research does not establish that competitors lack these capabilities. Ampere should demonstrate its own execution without claiming uniqueness.

## 4 Release scope

### Essential for the hackathon

- Responsive driver, host and administrator experiences with email sign-in and separate permissions.
- A Pune map and a fully usable list view with synthetic public and community listings.
- Car profile with connector support, usable battery capacity, conservative consumption, current battery and target battery.
- Mandatory reachable-range and connector filtering across driver results, with optional host type, power, time window, indicative total cost and freshness filters. Ineligible chargers are hidden from both the map and list.
- Charger detail page including access restrictions, connector, charging power, parking terms and source labels.
- Community booking request, two-minute host response window, payment simulation, confirmation and cancellation.
- Separate driver and host browser sessions showing persisted updates; no role-switch shortcut that bypasses ownership.
- Simulated check-in and charging session, an itemised demo receipt and illustrative host earnings.
- Host listing submission, schedule management and administrator verification.
- A failure demonstration for host decline or timeout, with alternatives requiring driver selection.
- Append-only booking events, replay-derived lifecycle, event-based live updates and the functional TICKET and READY Jury Console.

### Defer until the pilot or later

Real payments, verified metering, host payouts, telephone verification, documented support procedures, approved residential participation and operator data agreements belong to pilot preparation. Public-network charging commands, automated charger telemetry and reconciliation come after partner testing.

Premium subscriptions, automatic emergency dispatch, nationwide rollout, scooters, dynamic pricing, fleet optimisation, battery telemetry and AI chat are outside the 24-hour build. Keeping them out protects the working demonstration.

## 5 Core driver journey

### Discover and compare

The driver chooses a location or permits geolocation, selects a car profile, supplies battery information and chooses when to charge. Geolocation denial leads to manual area selection. Guest browsing is allowed; booking requires sign-in.

Every displayed result must first pass connector compatibility and the existing range calculation with its safety margin. Require a car, battery percentage and origin before presenting driver charger results; show an input prompt when they are missing. Each eligible result shows connector suitability, distance type, power, indicative cost, operating window and status provenance. Labels distinguish host-updated availability, partner telemetry, stale information, unknown information and demo data. A public directory record never appears as a confirmed open slot.

### Request and confirm a community slot

The driver chooses a start and end time, reviews the cancellation policy and requests a slot. The system temporarily holds the physical charging resource while the host responds. The booking displays requested and the driver must not be told to travel yet. Host acceptance appends an event, displays host confirmed and opens a five-minute checkout window. Payment completion is recorded separately; departure requires host confirmation and any applicable checkout requirement. The driver departure event displays on the way. Expiry or decline appends an outcome event and releases the hold without adding another booking lifecycle label.

Confirmation includes the reservation identifier, arrival window, private access details and contact method. All plans include host acceptance for community bookings. Reliability is a core requirement rather than a feature withheld from Basic customers.

### Arrive and charge

The driver starts navigation only after host confirmation and completion of any applicable checkout requirement. Starting the journey appends a departure event. Check-in is recorded without adding a sixth lifecycle state; starting the session displays charging and completing it displays done. A short-lived arrival code confirms that the driver and host are referring to the same booking. It verifies attendance, not electrical readiness. The host checks that the permitted bay and suitable equipment are available before charging begins.

The MVP simulates energy and session progress, with an explicit label. A real pilot uses approved meter evidence or an explicitly approved alternative billing method. An application timer cannot measure electricity. At completion the user sees the agreed tariff, measured or simulated quantity, fees, applicable taxes, payment status and any dispute path.

### Use a public charger

For directory-only public stations, the driver sees the operator link and navigation; the operator handles its own access, charging and payment. Ampere explains that it has not reserved a connector. For a future connected station, Ampere follows that operator's supported session flow. A command acknowledgement does not prove electricity is flowing; the session remains pending until an authoritative event confirms it.

## 6 Host journey and verification

The host records the property type, authority to offer access, restricted hours, parking dimensions, charger model, connector, rated power, cable arrangements, electricity supply limits and photographs. Residential hosts additionally explain gate access, visitor parking and applicable society or owner permission.

Verification has separate outcomes: identity reviewed, property access reviewed, equipment evidence reviewed and paid-operation eligibility reviewed. One generic Verified badge would conceal these distinctions. Only approved sites with complete evidence and an active schedule can accept real bookings. Demo verification uses synthetic records and cannot approve a real pilot host.

Hosts configure weekly availability, blackout dates and blocked periods for their own car. Each physical resource has capacity one in the MVP, even if it has several connectors. Simultaneous use of multiple ports requires explicit equipment and site-capacity modelling later.

Hosts can accept or decline requests, pause new bookings, view forthcoming arrivals and review completed sessions. Pausing a site does not erase confirmed bookings: it triggers a host-cancellation workflow for affected drivers. Earnings distinguish estimated, pending, disputed, eligible for payout and actually paid amounts. Host revenue after platform deductions is not host profit; electricity, maintenance, depreciation, insurance and tax remain host costs.

## 7 Availability and reservation rules

Availability combines opening hours, a compatible resource, host status, blackout periods, existing reservations, turnaround buffer and source freshness. A visible calendar is an invitation to request a slot, not physical proof that the charger works.

The default booking interval is 30 to 120 minutes in 15-minute increments, followed by a 15-minute buffer. An accepted host request still needs checkout within five minutes. Holds and bookings must be enforced in the database so two drivers cannot obtain the same resource at the same time.

Host acceptance expires after two minutes. Driver arrival is allowed from 10 minutes before to 15 minutes after the reserved start. Early departure ends the session; late arrival or overstay goes through an explicit policy rather than silently moving another driver's slot. Proposed extensions must be checked against later bookings. No-show classification is based on evidence and an operator review, not merely an app location signal.

## 8 Compatibility and battery estimates

The first car catalogue will be small and reviewed. It stores AC and DC capabilities separately. A matching connector name is necessary but not sufficient: charging mode, inlet support, cable ownership and effective power also matter. Unverified adapters and ordinary household sockets are excluded from the first pilot.

Battery-based recommendations use usable battery capacity, driver-entered state of charge and a conservative consumption estimate. The default reserve is 2 percentage points and the uncertainty multiplier is 1.25; these are tunable assumptions requiring validation. At 4% battery in a synthetic 40 kWh usable car, usable energy above reserve is 0.8 kWh. At 0.16 kWh/km multiplied by 1.25, the estimated distance budget is 4 km.

A road route is needed to call a charger plausibly reachable. Straight-line distance can exclude clearly distant options, but cannot confirm reachability. Without reliable route evidence, exclude unverified options from the driver result set and explain that no sufficiently verified reachable option is available. Demo route fixtures can support the labelled demonstration, but straight-line distance alone cannot prove a live road journey is within range. If no option meets the reserve, present an honest empty state and suggest contacting the driver's existing roadside assistance; do not invent a reachable option.

Charging duration uses the lower of vehicle and charger power, adjusted for site limits and an efficiency assumption. For illustration, adding 8 kWh to a battery at 7 kW and 90% efficiency takes about 76 minutes before overhead or tapering. If a 120-minute slot cannot satisfy the requested target, show the achievable energy rather than promise a full charge. AC charging does not become rapid roadside rescue because it is nearby.

## 9 Pricing and revenue design

The earlier pitch proposed ₹14/kWh, a ₹20 Standard booking fee, a ₹99 monthly plan and ₹499 per host site per month. These remain pricing hypotheses. Actual charging tariffs may differ by host, equipment, supply contract and applicable rules. Do not publish a universal tariff or assume identical tax treatment across electricity, charging services, fees and memberships.

The MVP should demonstrate Basic and Standard only. Basic has no recurring fee. Both require host confirmation for community reservations. Standard's proposed fee must fund clearly defined additional support, such as assisted rebooking and a capped promotional credit. Basic still receives mandatory refunds for undelivered service. Premium and host subscriptions stay as research concepts until repeated usage and support costs are observed.

There is no low-battery surge pricing. Ranking is not secretly influenced by paid placement. The full price is disclosed before the driver commits, with parking and overtime terms shown separately.

### Illustrative transaction and viability check

Assume 8 kWh at ₹14/kWh: the energy subtotal is ₹112. A Standard fee of ₹20 makes the displayed demo total ₹132. The demo does not represent a tax invoice. In a real sale, the approved tax and invoice configuration must determine what is inclusive and who supplies each line item.

For a management illustration only, assume platform revenue excluding tax of ₹16.80 commission plus ₹16.95 service fee, a 2.36% all-in gateway cost on ₹132, ₹5 support cost and ₹2 expected refunds or fraud. Contribution is approximately ₹23.63 per session before fixed overhead. At an assumed ₹40,000 monthly fixed cost, that requires about 1,693 sessions per month, or 57 per day across a 30-day month. This is sensitivity analysis, not a projection or an approved allocation of the ₹132 receipt.

The 2.36% gateway assumption means 2% plus an assumed 18% tax on that fee; it is not a guaranteed current merchant rate. Razorpay advertises different pricing conditions and offers, so the actual merchant agreement must replace this assumption. [S12]

The prior pitch's host profit figures and platform margins should not be reused as validated economics. A separate signed settlement model must reconcile customer collections, tax liabilities, platform revenue, operator or host payable, gateway fees and refunds. Without that reconciliation, a visually attractive price card can conceal an unviable host offer.

## 10 Payments and settlement

The hackathon uses simulation only. Every receipt and earnings screen identifies the transaction as Demo, and no payout is initiated.

The pilot payment design is a capped prepaid charging budget after host acceptance, followed by reconciliation against approved final session evidence. Surplus is returned through the approved refund path. A host cannot unilaterally increase the accepted tariff. An extension needs new driver consent and a fresh conflict check. Where equipment cannot enforce a budget or time limit remotely, the pilot needs an agreed host-assisted stopping procedure and cannot advertise automatic shutoff. Pressing Stop in the app is not proof that the vehicle has stopped drawing power. The exact merchant, host onboarding, settlement and prepaid arrangement must be approved with the payment provider before launch.

A payment screenshot or successful browser redirect is not confirmation. The server validates payment authenticity and captured status against its own order. Duplicate events must not create duplicate credits. A captured payment arriving after a hold expires becomes a refund or reconciliation case rather than reviving the slot. [S9]

Host payouts occur only after reconciled completion, required onboarding and resolution of material disputes. Ampere must not describe an internal database balance as escrow or a bank wallet. Cash collection and screenshot-based UPI verification are excluded from the pilot.

## 11 Cancellation and incident handling

- Host declines or times out before payment: release the hold and show alternatives. No charge is due.
- Host cancels after confirmation: return all undelivered prepaid amounts and the relevant booking fee through the original payment method; offer rebooking help. Promotional credit, if offered, is additional and capped.
- Driver cancels at least 30 minutes before start: proposed full refund. Later cancellation and no-show deductions need an approved policy and disclosed evidence; until approved, the pilot applies a full-refund default for unused service.
- Charger fails after arrival: pause the listing, record evidence and refund unused service. Do not promise compensation for consequential loss without an approved protection policy.
- Power fails mid-session: stop billing unmeasured energy, preserve readings, help the driver and refer settlement to review if evidence is incomplete.
- Driver or host disputes energy: hold the disputed payout and review meter evidence and event history. Do not settle on a timer estimate presented as measurement.
- Safety incident: stop use when safe, contact appropriate local emergency support, suspend the resource and document the incident. The app does not replace trained assistance.

Rebooking always requires driver consent and a fresh reachability check. Cancelling a charger must not automatically send a driver to a more distant option at low battery.

## 12 Hurdles and practical responses

### Domestic connections and property permission

The 2024 national guidelines describe EV charging as a de-licensed activity subject to their requirements. Clause 15 permits owners to charge their own EVs using an existing home connection. Clause 16 addresses authorised visitors at community stations and links community fees to applicable tariffs and service ceilings. Clauses 8 to 10 address charging-fee components, metering and service charges. These provisions support a conditional sharing model; they do not establish unrestricted paid access by strangers at every residence. The 2024 text was inspected directly, but later amendments and current local implementation still need review. [S6, S7]

Before residential activation, the operating lead must verify the current MSEDCL or relevant DISCOM tariff category, sanctioned load, any separate-meter requirement, local fire or building conditions, society or landlord consent and insurance. A charging-service label or a booking-fee label does not bypass applicable restrictions; the full proposed service charge, including any platform fee treatment, needs review before approving the ₹14 and ₹20 examples. Commercial sites require their own review too. The pilot should contain all requested host categories, but each site goes live only after its requirements are met.

### Equipment and site capacity

Require qualified electrical review of installation, protective devices, earthing, cable condition, load and parking arrangement. Store the outcome and validity date. Ampere software cannot certify electrical safety or safely switch every charger. Shared building load needs site-level capacity controls before concurrent resources are enabled.

### Data rights and public integrations

Obtain permission for charger data, images, status feeds and permitted caching. Preserve operator IDs and avoid duplicate pins. Do not infer public access from a location being publicly visible online. OCPI connects platforms; OCPP connects charging equipment and its management system. They solve different integration problems. [S5]

### Trust and privacy

Residential discovery exposes an approximate area. The server uses protected exact coordinates to evaluate route eligibility before displaying a result, without returning those coordinates or the private route to the driver. If it cannot establish eligibility, it excludes the listing. Exact entrance, address and host contact become available only to an authorised confirmed driver. The server rechecks reachability before departure. Avoid collecting identity documents beyond the defined verification need. Separate private documents from public charger photos and keep access logs.

### Marketplace liquidity and host incentives

Launch around one Pune cluster rather than claim nationwide coverage. Recruit several dependable sites, observe actual response times and interview drivers who fail to book. Hosts may gain little after electricity and service costs, so validate their net proceeds before expanding. Prevent off-platform leakage by delivering useful booking records, support and repeat convenience, rather than restrictive claims.

## 13 Technology and data overview

Use one Next.js and TypeScript application, Tailwind CSS and shadcn/ui, backed by Supabase Auth, PostgreSQL, Storage and Realtime. React Leaflet can display a map using a permitted tile provider; routing and geocoding are separate services. OpenStreetMap's public tiles have a usage policy and no availability guarantee, so production must use suitable contracted services. [S8]

The core records are users, vehicles, sites, private access details, physical charging resources, connectors, availability windows, verification checks, tariffs, quotes, reservations, session evidence, payment attempts, refunds, host payables and audit events. Physical resource reservations prevent conflicts across connector variants on the same equipment.

Database policies isolate each driver's bookings and each host's sites. Critical reservation, quote, payment and status changes are validated on the server, with database enforcement beneath them. Booking events are the authoritative record. Every booking action appends an event, and the interface reconstructs its lifecycle by replaying events in sequence. Live booking updates carry new authorised events rather than replacement status fields. Refresh and reconnect fetch missed events and replay them. Database access controls still apply. [S10]

## 14 Product experience and screen inventory

- Discovery: location, car and battery inputs, map or list, filters, provenance and useful empty states.
- Charger details: connectors, effective charging estimate, access summary, full tariff, freshness and supported actions.
- Booking: time selection, quote, policy consent, host response countdown, checkout and confirmation.
- Active booking: the five permitted lifecycle states, private arrival details, arrival code, contact, cancellation, progress and help. Payment, cancellation and incident information is shown as separate explanatory notices, not additional booking lifecycle states.
- Jury Console: plain-text command input, matching eligible results, persistent booking reference, READY confirmation and event history after refresh.
- Receipt and history: session evidence, financial breakdown, refund status and review eligibility.
- Host dashboard: listing status, schedule, incoming requests, arrivals, session evidence and payable history.
- Administrator queue: verification evidence, suspension, dispute resolution, event history and payment exceptions.

Design for mobile use in a parked vehicle, readable contrast, large controls and keyboard access. Map markers are supplementary to a searchable list. Status must use words as well as colour. The app must preserve booking state after reload and communicate errors without hiding recovery actions.

## 15 Development roadmap

### Hours 0 to 3

Agree data contracts and fixture scenarios, establish authentication and migrations, design the core screens and confirm a successful deploy. One developer owns platform and database, one discovery and estimates, one host and admin journeys, and one booking, payment simulation and integration testing. Shared contract ownership comes before parallel feature changes.

### Hours 3 to 10

Implement discovery with fixture data, car matching, listings, host schedules and approval. Complete atomic event appends, replay, slot holding, host acceptance and the first TICKET and READY console path before polishing animations. Demonstrate driver-to-host persistence across two sessions.

### Hours 10 to 17

Connect simulated checkout, arrival, simulated sessions, receipts and illustrative earnings. Exercise cancellation, timeout, double-booking attempts, unauthorised access, event replay after refresh, event delivery after reconnect, console commands and map-service failure. Integrate the full demonstration path.

### Hours 17 to 24

Freeze scope, fix only blocking issues, reset fixtures, rehearse the three-minute presentation and record a fallback video. If time is tight, remove payment sandbox integration, subscriptions and advanced routing before weakening booking correctness or identity separation.

### Pilot preparation and expansion

Prepare reviewed hosts, approved tariffs and payment arrangements, evidence collection, a support roster and operational policies. Seek public-network agreements in parallel. Expand only after completed sessions, response reliability and net contribution support the decision. Public beta and additional vehicle classes follow measured evidence rather than a fixed promised date.

## 16 Measures and release decisions

The hackathon succeeds when the normal driver and host flow and the jury console both work, out-of-range and wrong-connector chargers are hidden, and a host-confirmed booking is reconstructed from persisted events after refresh. Collisions must still be prevented, failed hosts handled and the fallback discovery experience kept usable.

Proposed pilot targets are 10 approved sites across the selected host categories, 30 opted-in drivers and at least 50 completed sessions during a four-week observation period. Track host acceptance and response time, request-to-completion conversion, arrival failures, refunds, support minutes per session, repeat use, host retention and contribution after variable costs. Targets are planning assumptions, not market evidence.

Use at least 90% successful arrival and usable access among confirmed bookings as an initial investigation threshold, and pause expansion after a serious unresolved safety incident. Small pilot samples cannot demonstrate safety or general market demand. A positive contribution must also compensate hosts adequately; platform margin alone is not the launch decision.

## 17 Demonstration scenario

At the start, show a clearly labelled synthetic Pune driver with 4% battery and a reviewed demo car profile. Show a nearby incompatible charger excluded from recommendations, a public directory option with unknown status and a compatible café charger within the seeded road-distance budget.

The driver requests 8 kWh of grid energy in a 90-minute slot. At ₹14/kWh plus the ₹20 Standard fee, the demo checkout is ₹132. The host accepts in a second session, checkout succeeds in Demo mode and private arrival details become visible. At 7 kW, this is about 69 minutes of estimated charging before overhead, with approximately 7.2 kWh reaching the battery at 90% efficiency. The display clearly accelerates this time for demonstration. A completed receipt and pending illustrative host proceeds close the flow. An optional replay declines the first request and shows alternatives without automatically booking them.

The list, route distances and fixture records must remain usable without live map tiles or routing. An internet outage still prevents live multi-user persistence unless a separately labelled local demo mode is prepared; the fallback video remains the final presentation backup.

## 18 Decisions still requiring evidence

- Which Pune cluster has enough permitted hosts and car-owner demand within useful travel distance?
- Which residential sites can legally and operationally provide paid charging on their supply arrangements?
- Which verified equipment models and car variants will the first pilot support?
- What is the final tax, invoice, commission and host-payout allocation for each tariff?
- Does a payment provider approve the proposed collection and reconciliation model?
- Will drivers pay for additional rebooking support, and what does each support event cost?
- What partner data and charging capabilities can Ampere actually contract for?

These questions do not block a synthetic hackathon build. They block the affected live service until resolved. No competitor scale figure, simulated buyer vote, estimated margin or protection claim should be presented as a verified Ampere result.

## 19 Sources and evidence notes

Sources were reviewed on 21 October 2026. Product claims remain attributed to their publishers. Source availability and integration terms can change.

- [S1] ChargeIndia homepage — https://chargeindia.com/ — public-network product description; functionality was not tested.
- [S2] ChargeIndia business — https://chargeindia.com/business — published interoperability proposition.
- [S3] PeerChargeEV — https://peerchargeev.in/ — P2P workflow from the website's search-indexed text; live body extraction was limited.
- [S4] ChargeIndia Hub getting started — https://docs.hub.chargeindia.com/getting-started — agreement, credentials and coordinated testing prerequisites.
- [S5] OCPI specification repository — https://github.com/ocpi/ocpi — platform roaming scope; partner-specific implementation must be checked separately.
- [S6] Bureau of Energy Efficiency — https://beeindia.gov.in/?lang=1&level=1&lid=326&ls_id=193 — official listing of the 2024 charging infrastructure guidelines. This is a policy reference, not site approval.
- [S7] Ministry of Power charging infrastructure guidelines 2024 — https://beeindia.gov.in/WriteReadData/L45218/2841453721548450.pdf — official BEE-hosted PDF inspected directly; clauses 5, 8 to 10, 15 and 16. Later amendments and site-specific applicability require review.
- [S8] OpenStreetMap tile usage policy — https://operations.osmfoundation.org/policies/tiles/ — attribution, permitted use and service limitations.
- [S9] Razorpay integration steps — https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/ — server-side signature and payment-status verification.
- [S10] Supabase row level security — https://supabase.com/docs/guides/database/postgres/row-level-security — database access controls and privileged-key handling.
- [S11] ChargeIndia session lifecycle — https://docs.hub.chargeindia.com/session-lifecycle — asynchronous charging state and command handling for a future contracted integration.
- [S12] Razorpay pricing — https://razorpay.com/pricing/ — published plans and offers; a merchant-specific quotation is needed.

## 20 Glossary

kW is charging power; kWh is energy. State of charge is the battery percentage. An EVSE is a physical charging resource. A CPO operates charging stations; an eMSP offers charging services to drivers. OCPI exchanges roaming information between platforms; OCPP connects charging equipment with a charging management system. A CDR is a final charging detail record. Estimated host proceeds are not host profit, and a simulated charging session is not evidence of physical electricity delivery.


## 21 Assigned jury twist and final round preparation

### Event based booking history

Each request, host confirmation, departure, charging start and completion becomes a new immutable event attached to the same booking reference. Replaying these events yields requested, host confirmed, on the way, charging and done respectively. Payment, arrival, cancellation, timeout and dispute events preserve their business meaning without creating extra lifecycle labels. An ended or cancelled booking keeps its last lifecycle stage with a clear separate outcome notice and disabled journey actions; it must not pretend charging completed.

The database may maintain a rebuildable projection for searching and preventing overlaps, but that projection cannot replace the event log. The normal host button and jury READY command must append the same type of confirmation event. Refresh must fetch and replay the persisted stream; browser storage and hard-coded console output do not satisfy the twist. Realtime messages carry new events and reconnect recovers any gaps.

### Plain text console commands

The console is part of the same application and database. It accepts one command per line with the exact pipe-separated grammar below. Angle brackets indicate input values and are not typed literally.

```text
TICKET|<car model>|<battery percent>|<lat>|<lon>|<connector>
READY|<booking ref>|<ISO time>
```

The supplied example is:

```text
TICKET|Tata Nexon EV|4|18.5362|73.8939|CCS2
```

TICKET resolves the car profile, applies the existing range calculation and safety margin, and displays only matching chargers within that range. It selects a deterministic eligible community resource with a valid slot, creates a real persisted booking request through the normal service and prints the booking reference. If there is no eligible reservable result, it prints a clear no-match explanation and creates no booking. Selecting a charger does not mean the host has confirmed it.

READY accepts that reference and a valid ISO datetime, appends the host confirmation event and prints host confirmed. The timestamp is recorded as reported information; server time and event sequence still control deadlines and replay. The console provides the current server time and a copyable READY line so the jury can run both commands without guessing the reference. The console does not silently record departure or charging.

In the isolated demo, READY is an explicitly labelled jury simulation of the host action, authorised through a restricted jury session. In a real deployment only the relevant host or an approved operational role can confirm. The normal host acceptance flow remains functional, and drivers cannot use a public console endpoint to confirm their own bookings.

### Required jury proof

- At 4% battery, the results hide a charger beyond the existing range budget.
- A nearby charger with the wrong connector is absent from driver results and cannot be booked through TICKET.
- TICKET prints a stored booking reference, and READY changes that same booking to host confirmed.
- After refreshing, the app fetches the stream from the database and restores host confirmed by replay, including when browser state is cleared.
- The normal map and buttons use the same filters, events and state derivation, preserving the original journey.

The organiser asks for a real charger inside range and another outside it. Prepare verified real-world listing records for those cases in the application's database, plus a nearby wrong-connector example. If the existing seed is not in Pune, adjust the sample origin to the actual seed cluster and print the corresponding command. Synthetic regression fixtures must remain labelled and cannot be presented as those verified real-world examples. The booking and charging demonstration remains simulated; a real location record does not imply live access or permission to charge there.

### Organiser requirements supplied with the twist

The team must submit its GitHub repository link using the supplied Google Form immediately, arrange for at least one team member or leader to join the official WhatsApp group, and report to college on 22 October 2026 for the final demonstration. Reporting time and room were not specified and must be confirmed with the organiser. Record these as pending team actions until someone has completed them; this document update does not submit the form or join a group.

Repository submission form: https://docs.google.com/forms/d/e/1FAIpQLSe5t6Jn9096ClVf77CerBM-2GJ7D21_7xWEXpTwpdDlNmvdyg/viewform

Official WhatsApp group supplied by the organiser: https://chat.whatsapp.com/JALoIku0duB8cW3vM9UTtS

Prioritise the functional console, strict filters and replay-after-refresh proof before additional presentation polish. The organiser has stated that the implemented twist earns extra points and a missing or non-functional console loses points; no numerical score or winning outcome is assumed.
