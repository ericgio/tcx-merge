const fs = require('fs');
const xml2js = require('xml2js');
const util = require('util');

function getLaps(obj) {
  return (
    obj &&
    obj.TrainingCenterDatabase &&
    obj.TrainingCenterDatabase.Activities &&
    obj.TrainingCenterDatabase.Activities.length &&
    obj.TrainingCenterDatabase.Activities[0] &&
    obj.TrainingCenterDatabase.Activities[0].Activity &&
    obj.TrainingCenterDatabase.Activities[0].Activity.length &&
    obj.TrainingCenterDatabase.Activities[0].Activity[0] &&
    obj.TrainingCenterDatabase.Activities[0].Activity[0].Lap
  ) || [];
}

function parseFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      xml2js.parseString(data, (err, result) => {
        const filename = path.split('/').pop();
        console.log('Successfully parsed `' + filename + '`');
        resolve(result);
      });
    });
  });
}

// Normalize args
const args = process.argv.slice(2);
const activity1 = args[0];
const activity2 = args[1];
const outputFile = args[2];

let obj1, obj2;

const p = new Promise((resolve, reject) => {
  parseFile(activity1)
    .then((value) => obj1 = value)
    .then(() => {
      parseFile(activity2).then((value) => {
        obj2 = value;
        resolve();
      });
    });
})
.then(() => {
  // Get the total distance from the first activity
  // by summing the lap distances.
  const laps1 = getLaps(obj1);
  const distance1 = laps1.reduce((totalDistance, currLap) => (
    totalDistance + +currLap.DistanceMeters[0]
  ), 0);

  // Get all laps from the second activity
  const laps2 = getLaps(obj2);

  // Loop through each trackpoint in the second activity and add the
  // total distance from the first activity.
  const adjusted = laps2.map((lap) => {
    let trackpoints = lap.Track[0].Trackpoint;
    trackpoints = trackpoints.map((trackpoint) => {
      if (trackpoint.DistanceMeters && trackpoint.DistanceMeters[0]) {
        const adjustedDistance = +trackpoint.DistanceMeters[0] + distance1;
        trackpoint.DistanceMeters[0] = adjustedDistance + '';
      }
      return trackpoint;
    });
    lap.Track[0].Trackpoint = trackpoints;
    return lap;
  });

  // Append laps from second activity to first activity
  obj1.TrainingCenterDatabase.Activities[0].Activity[0].Lap = laps1.concat(adjusted);

  // Convert JS object back to XML and save to file.
  const builder = new xml2js.Builder();
  const xml = builder.buildObject(obj1);

  console.log('Writing merged file...');
  fs.writeFile(outputFile, xml, (err) => {
    console.log('Done.');
  });
});
