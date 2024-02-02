let AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-north-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = 'AcademicCourses';
const healthPath = '/health';
const coursePath = '/course';
const coursesPath = '/courses';

exports.handler = async function (event) {
    console.log('Request event: ', event);
    let response;
    switch (true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;
        case event.httpMethod === 'GET' && event.path === coursePath:
            response = await getCourse(parseInt(event.queryStringParameters.courseId, 10));
            break;
        case event.httpMethod === 'GET' && event.path === coursesPath:
            response = await getCourses();
            break;
        case event.httpMethod === 'POST' && event.path === coursePath:
            response = await saveCourse(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path === coursePath:
            const requestBody = JSON.parse(event.body);
            response = await modifyCourse(requestBody.courseId, requestBody.updateKey, requestBody.updateValue);
            break;
        case event.httpMethod === 'DELETE' && event.path === coursePath:
            response = await deleteCourse(JSON.parse(event.body).courseId);
            break;

    }
    return response;
};

async function getCourse(courseId) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'courseId': courseId
        }
    };

    return await dynamodb.get(params).promise().then((response) => {
        return buildResponse(200, response.Item);
    }, (error) => {
        console.error('Do your custom error handling here. I am just gonna log it: ', error);
    });
}


async function getCourses() {
    const params = {
        TableName: dynamodbTableName
    };
    const allCourses = await scanDynamoRecords(params, []);
    const body = {
        courses: allCourses
    };
    return buildResponse(200, body);
}

async function scanDynamoRecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if (dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (error) {
        console.error('Do your custom error handling here. I am just gonna log it: ', error);
    }
}

async function saveCourse(requestBody) {
    const params = {
        TableName: dynamodbTableName,
        Item: requestBody
    };
    return await dynamodb.put(params).promise().then(() => {
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: requestBody
        };
        return buildResponse(200, body);
    }, (error) => {
        console.error('Do your custom error handling here. I am just gonna log it: ', error);
    });
}

async function modifyCourse(courseId, updateKey, updateValue) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'courseId': courseId
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value': updateValue
        },
        ReturnValues: 'UPDATED_NEW'
    };
    return await dynamodb.update(params).promise().then((response) => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            UpdatedAttributes: response
        };
        return buildResponse(200, body);
    }, (error) => {
        console.error('Do your custom error handling here. I am just gonna log it: ', error);
    });
}

async function deleteCourse(courseId) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'courseId': courseId
        },
        ReturnValues: 'ALL_OLD'
    };
    return await dynamodb.delete(params).promise().then((response) => {
        const body = {
            Operation: 'DELETE',
            Message: 'SUCCESS',
            Item: response
        };
        return buildResponse(200, body);
    }, (error) => {
        console.error('Do your custom error handling here. I am just gonna log it: ', error);
    });
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

