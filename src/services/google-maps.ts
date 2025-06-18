import { PlacesClient } from "@googlemaps/places";
import { GoogleAuth } from "google-auth-library";
import { CREDENTIALS } from "../lib/constants";

const apiKey = CREDENTIALS.google_maps_api_key!;

const authClient = new GoogleAuth().fromAPIKey(apiKey);

const placesClient = new PlacesClient({ authClient });

export { placesClient };
