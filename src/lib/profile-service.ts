import { profileClient } from "@/lib/grpc-client";
import { Profile } from "../../proto/gen/ts/jules";

export class ProfileService {
  async getProfiles(): Promise<Profile[]> {
    return new Promise((resolve, reject) => {
        profileClient.listProfiles({}, (err, res) => err ? reject(err) : resolve(res.profiles));
    });
  }

  async createProfile(name: string): Promise<Profile> {
      return new Promise((resolve, reject) => {
          profileClient.createProfile({ name }, (err, res) => err ? reject(err) : resolve(res));
      });
  }

  async deleteProfile(id: string): Promise<void> {
     return new Promise((resolve, reject) => {
         profileClient.deleteProfile({ id }, (err) => err ? reject(err) : resolve());
     });
  }
}

export const profileService = new ProfileService();
