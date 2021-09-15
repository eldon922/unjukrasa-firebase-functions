import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
admin.initializeApp();

const db = admin.firestore();

const functionsJakartaRegion = functions.region("asia-southeast2");

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

        db.collection("users").doc(demonstration.initiatorUid).update({
          demonstrations: admin.firestore.FieldValue
              .arrayUnion({
                id: context.params.id,
                title: demonstration.title,
                youtubeThumbnailUrl: "http://img.youtube.com/vi/"+
                  demonstration.youtube_video +"/0.jpg"}),
        });

        const userName = (await db.collection("users")
            .doc(demonstration.initiatorUid).get()).get("name");

        return snap.ref.update({
          participation: 0,
          upvote: 0,
          downvote: 0,
          share: 0,
          numberOfAction: 0,
          persons: [
            {
              uid: demonstration.initiatorUid,
              name: userName,
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

    if ((action != "share" &&
    !(userData.get("participation") as Array<string>)
        .includes(demonstrationId) &&
    !(userData.get("upvote") as Array<string>).includes(demonstrationId) &&
    !(userData.get("downvote") as Array<string>).includes(demonstrationId)) ||
    ((action == "share" &&
    !(userData.get("share") as Array<string>).includes(demonstrationId)))) {
      userRef.update({
        [action]: admin.firestore.FieldValue.arrayUnion(demonstrationId),
      });

      db.collection("demonstrations").doc(demonstrationId).update({
        [action]: admin.firestore.FieldValue.increment(1),
        numberOfAction: admin.firestore.FieldValue.increment(1),
      });

      return {
        action: action,
        uid: userId,
        success: true,
      };
    } else {
      return {
        action: action,
        uid: userId,
        success: false,
      };
    }
  });

export const cancelDemonstrationAction =
  functionsJakartaRegion.https.onCall(async (data, context) => {
    const action = data.action as string;
    const userId = context.auth?.uid as string;
    const demonstrationId = data.demonstrationId as string;

    const userRef = db.collection("users").doc(userId);
    const userData = await userRef.get();

    if (action != "share" &&
    (userData.get(action) as Array<string>).includes(demonstrationId)) {
      userRef.update({
        [action]: admin.firestore.FieldValue.arrayRemove(demonstrationId),
      });

      db.collection("demonstrations").doc(demonstrationId).update({
        [action]: admin.firestore.FieldValue.increment(-1),
        numberOfAction: admin.firestore.FieldValue.increment(1),
      });

      return {
        action: action,
        uid: userId,
        success: true,
      };
    } else {
      return {
        action: action,
        uid: userId,
        success: false,
      };
    }
  });
