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

        db.collection("users").doc(demonstration.initiatorUID).update({
          demonstrations: admin.firestore.FieldValue
              .arrayUnion({id: context.params.id, title: demonstration.title}),
        });

        const userName = (await db.collection("users")
            .doc(demonstration.initiatorUID).get()).get("name");

        return snap.ref.update({
          participation: 0,
          upvote: 0,
          downvote: 0,
          share: 0,
          persons: [
            {
              uid: demonstration.initiatorUID,
              name: userName,
            },
          ],
        });
      });

export const demonstrationAction =
  functionsJakartaRegion.https.onRequest(async (request, response) => {
    const action = request.query.action as string;
    const userId = request.query.userId as string;
    const demonstrationId = request.query.demonstrationId as string;

    const userRef = db.collection("users").doc(userId);

    if (!((await userRef.get()).get(action) as Array<string>)
        .includes(demonstrationId)) {
      userRef.update({
        [action]: admin.firestore.FieldValue.arrayUnion(demonstrationId),
      });

      db.collection("demonstrations").doc(demonstrationId).update({
        [action]: admin.firestore.FieldValue.increment(1),
      });

      response.send(true);
    } else {
      response.send(false);
    }
  });
