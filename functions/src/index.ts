import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import algoliasearch from "algoliasearch";
admin.initializeApp();

const db = admin.firestore();

const functionsJakartaRegion = functions.region("asia-southeast2");

const ALGOLIA_ID = functions.config().algolia.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key;

const ALGOLIA_INDEX_NAME = "demonstrations";
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY);

export const onUserCreate =
  functionsJakartaRegion.firestore.document("/users/{id}")
      .onCreate((snap) => {
        return snap.ref.update({
          demonstrations: [],
          participation: [],
          upvote: [],
          downvote: [],
          share: [],
          involve: [],
        });
      });

export const onDemonstrationCreate =
  functionsJakartaRegion.firestore.document("/demonstrations/{id}")
      .onCreate(async (snap, context) => {
        const demonstration = snap.data();
        demonstration.id = context.params.id;

        db.collection("users").doc(demonstration.initiatorUid).update({
          demonstrations: admin.firestore.FieldValue
              .arrayUnion({
                id: demonstration.id,
                title: demonstration.title,
                youtubeThumbnailUrl: "http://img.youtube.com/vi/"+
                  demonstration.youtube_video +"/0.jpg"}),
          participation: admin.firestore.FieldValue
              .arrayUnion(demonstration.id),
          upvote: admin.firestore.FieldValue.arrayUnion(demonstration.id),
        });

        const userName = (await db.collection("users")
            .doc(demonstration.initiatorUid).get()).get("name");

        const index = client.initIndex(ALGOLIA_INDEX_NAME);
        index.saveObject({
          objectID: demonstration.id,
          userName: userName,
          title: demonstration.title,
          description: demonstration.description,
          youtubeThumbnailUrl: "http://img.youtube.com/vi/"+
            demonstration.youtube_video +"/0.jpg",
        });

        return snap.ref.update({
          participation: 1,
          upvote: 1,
          downvote: 0,
          share: 0,
          numberOfAction: 0,
          persons: [
            {
              uid: demonstration.initiatorUid,
              name: userName,
              role: "Inisiator",
            },
          ],
        });
      });

export const demonstrationAction =
  functionsJakartaRegion.https.onCall(async (data, context) => {
    const action = data.action as string;
    const userId = context.auth?.uid as string;
    const demonstrationId = data.demonstrationId as string;

    const userRef = db.collection("users").doc(userId);
    const userData = await userRef.get();

    let success = true;

    if ((!(userData.get(action) as Array<string>).includes(demonstrationId) &&
    !(userData.get("downvote") as Array<string>).includes(demonstrationId)) ||
    action == "share") {
      if (action == "participation" &&
      !(userData.get("upvote") as Array<string>).includes(demonstrationId)) {
        userRef.update({
          [action]: admin.firestore.FieldValue.arrayUnion(demonstrationId),
          upvote: admin.firestore.FieldValue.arrayUnion(demonstrationId),
        });

        db.collection("demonstrations").doc(demonstrationId).update({
          [action]: admin.firestore.FieldValue.increment(1),
          upvote: admin.firestore.FieldValue.increment(1),
          numberOfAction: admin.firestore.FieldValue.increment(1),
        });
      } else if (action == "share" ||
      (action == "participation" &&
      (userData.get("upvote") as Array<string>).includes(demonstrationId)) ||
      (!(userData.get("upvote") as Array<string>).includes(demonstrationId) &&
      !(userData.get("participation") as Array<string>)
          .includes(demonstrationId))) {
        userRef.update({
          [action]: admin.firestore.FieldValue.arrayUnion(demonstrationId),
        });

        db.collection("demonstrations").doc(demonstrationId).update({
          [action]: admin.firestore.FieldValue.increment(1),
          numberOfAction: admin.firestore.FieldValue.increment(1),
        });
      }
    } else {
      success = false;
    }

    return {
      action: action,
      uid: userId,
      success: success,
    };
  });

export const cancelDemonstrationAction =
  functionsJakartaRegion.https.onCall(async (data, context) => {
    const action = data.action as string;
    const userId = context.auth?.uid as string;
    const demonstrationId = data.demonstrationId as string;

    const userRef = db.collection("users").doc(userId);
    const userData = await userRef.get();

    let success = true;

    if (action != "share" &&
    (userData.get(action) as Array<string>).includes(demonstrationId)) {
      if (action == "upvote" &&
      (userData.get("participation") as Array<string>).includes(demonstrationId)
      ) {
        userRef.update({
          [action]: admin.firestore.FieldValue.arrayRemove(demonstrationId),
          participation: admin.firestore.FieldValue
              .arrayRemove(demonstrationId),
        });

        db.collection("demonstrations").doc(demonstrationId).update({
          [action]: admin.firestore.FieldValue.increment(-1),
          participation: admin.firestore.FieldValue.increment(-1),
          numberOfAction: admin.firestore.FieldValue.increment(1),
        });
      } else {
        userRef.update({
          [action]: admin.firestore.FieldValue.arrayRemove(demonstrationId),
        });

        db.collection("demonstrations").doc(demonstrationId).update({
          [action]: admin.firestore.FieldValue.increment(-1),
          numberOfAction: admin.firestore.FieldValue.increment(1),
        });
      }
    } else {
      success = false;
    }

    return {
      action: action,
      uid: userId,
      success: success,
    };
  });
